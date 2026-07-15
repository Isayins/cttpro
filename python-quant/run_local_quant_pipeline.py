from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import subprocess
import sys
import traceback
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import akshare as ak
import pandas as pd
import pymysql
from pymysql.cursors import DictCursor


DEFAULT_DB_HOST = "127.0.0.1"
DEFAULT_DB_PORT = 3306
DEFAULT_DB_USER = "root"
DEFAULT_DB_PASSWORD = "root"
DEFAULT_DB_NAME = "quant"
DEFAULT_SOURCE_DIR = r"I:\Stock\Stock\Everyday2\UnAdjustedStock"
DEFAULT_REPORT_PRESETS = ("balanced", "aggressive")

CN_DATE = "\u65e5\u671f"
CN_CODE = "\u4ee3\u7801"
CN_NAME = "\u540d\u79f0"
CN_INDUSTRY = "\u6240\u5c5e\u884c\u4e1a"
CN_BOARD_NAME = "\u677f\u5757\u540d\u79f0"
CN_BOARD_CODE = "\u677f\u5757\u4ee3\u7801"
CN_NOTICE_DATE = "\u516c\u544a\u65e5\u671f"
CN_NOTICE_TITLE = "\u516c\u544a\u6807\u9898"
CN_NOTICE_CODE = "\u4ee3\u7801"
CN_NOTICE_NAME = "\u540d\u79f0"
CN_NOTICE_URL = "\u516c\u544a\u94fe\u63a5"


@dataclass(frozen=True)
class PipelineContext:
    root_dir: Path
    report_dir: Path
    log_dir: Path
    job_id: str
    today: date


class LocalQuantPipeline:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        root_dir = Path(__file__).resolve().parent
        today = datetime.now().date()
        job_id = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8]
        report_dir = root_dir / "reports" / "daily-quant" / today.strftime("%Y%m%d")
        log_dir = root_dir / "logs" / "daily-quant"
        self.context = PipelineContext(
            root_dir=root_dir,
            report_dir=report_dir,
            log_dir=log_dir,
            job_id=job_id,
            today=today,
        )
        self.logger = logging.getLogger("local_quant_pipeline")
        self.log_path = self.context.log_dir / f"{today.strftime('%Y%m%d')}-{args.mode}-{job_id}.log"
        self.report_path = self.context.report_dir / f"{args.mode}-{job_id}.json"
        self.summary_path = self.context.report_dir / f"{args.mode}-{job_id}.md"
        self.run_started_at = datetime.now()

    def run(self) -> dict[str, Any]:
        self._ensure_output_dirs()
        self._configure_logging()
        self.logger.info("Starting local quant pipeline: mode=%s job_id=%s", self.args.mode, self.context.job_id)
        self._ensure_support_tables()

        run_record = self._start_run_record()
        payload: dict[str, Any] = {
            "jobId": self.context.job_id,
            "mode": self.args.mode,
            "startedAt": self.run_started_at.strftime("%Y-%m-%d %H:%M:%S"),
            "tradeDate": self.context.today.strftime("%Y-%m-%d"),
            "config": {
                "dbHost": self.args.db_host,
                "dbPort": self.args.db_port,
                "dbName": self.args.db_name,
                "sourceDir": self.args.source_dir,
                "reportPresets": list(self.args.report_presets),
                "screenerTop": self.args.screener_top,
                "enableTushareSync": self.args.enable_tushare_sync,
            },
            "steps": {},
        }

        try:
            payload["steps"]["unadjustedImport"] = self._run_unadjusted_import()
            payload["steps"]["stockBasicRefresh"] = self._refresh_stock_basic()
            if self.args.enable_tushare_sync:
                payload["steps"]["tushareEnhancedSync"] = self._run_tushare_enhanced_sync()
            payload["steps"]["industryBoards"] = self._sync_industry_boards()
            payload["steps"]["dailyBasic"] = self._sync_daily_basic_from_spot()
            payload["steps"]["moneyflow"] = self._sync_moneyflow_ranks()
            payload["steps"]["content"] = self._sync_content_datasets()
            payload["steps"]["financials"] = self._sync_financial_indicators()
            payload["steps"]["analysis"] = self._run_analysis_reports()
            payload["finishedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            payload["status"] = "completed"
            payload["summary"] = self._build_summary(payload)
            self._write_outputs(payload)
            self._finish_run_record(run_record, "completed", payload)
            self.logger.info("Pipeline completed successfully: job_id=%s", self.context.job_id)
            return payload
        except Exception as exc:
            payload["finishedAt"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            payload["status"] = "failed"
            payload["error"] = str(exc)
            payload["traceback"] = traceback.format_exc()
            self._write_outputs(payload)
            self._finish_run_record(run_record, "failed", payload)
            self.logger.exception("Pipeline failed: job_id=%s", self.context.job_id)
            raise

    def _ensure_output_dirs(self) -> None:
        self.context.report_dir.mkdir(parents=True, exist_ok=True)
        self.context.log_dir.mkdir(parents=True, exist_ok=True)

    def _configure_logging(self) -> None:
        self.logger.setLevel(logging.INFO)
        self.logger.handlers.clear()
        formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

        file_handler = logging.FileHandler(self.log_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        self.logger.addHandler(file_handler)

        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        self.logger.addHandler(stream_handler)

    def _connect(self) -> pymysql.connections.Connection:
        return pymysql.connect(
            host=self.args.db_host,
            port=self.args.db_port,
            user=self.args.db_user,
            password=self.args.db_password,
            database=self.args.db_name,
            charset="utf8mb4",
            autocommit=True,
            cursorclass=DictCursor,
        )

    def _execute(self, sql: str, params: tuple[Any, ...] | None = None) -> int:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                return int(cursor.execute(sql, params))

    def _fetch_all(self, sql: str, params: tuple[Any, ...] | None = None) -> list[dict[str, Any]]:
        with self._connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(sql, params)
                return list(cursor.fetchall())

    def _fetch_one(self, sql: str, params: tuple[Any, ...] | None = None) -> dict[str, Any] | None:
        rows = self._fetch_all(sql, params)
        return rows[0] if rows else None

    def _executemany(self, sql: str, payloads: list[tuple[Any, ...]]) -> int:
        if not payloads:
            return 0
        with self._connect() as connection:
            with connection.cursor() as cursor:
                return int(cursor.executemany(sql, payloads))

    def _ensure_support_tables(self) -> None:
        ddl_statements = [
            """
            CREATE TABLE IF NOT EXISTS stock_basic (
                ts_code varchar(32) NOT NULL,
                symbol varchar(16) DEFAULT NULL,
                name varchar(128) DEFAULT NULL,
                fullname varchar(255) DEFAULT NULL,
                enname varchar(255) DEFAULT NULL,
                exchange varchar(16) DEFAULT NULL,
                market varchar(16) DEFAULT NULL,
                industry varchar(128) DEFAULT NULL,
                area varchar(64) DEFAULT NULL,
                list_status varchar(8) DEFAULT NULL,
                list_date date DEFAULT NULL,
                delist_date date DEFAULT NULL,
                is_hs varchar(8) DEFAULT NULL,
                curr_type varchar(16) DEFAULT NULL,
                act_name varchar(128) DEFAULT NULL,
                act_ent_type varchar(64) DEFAULT NULL,
                created_at datetime DEFAULT CURRENT_TIMESTAMP,
                updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code),
                KEY idx_stock_basic_symbol (symbol),
                KEY idx_stock_basic_list_status (list_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """,
            """
            CREATE TABLE IF NOT EXISTS ths_index (
                ts_code varchar(32) NOT NULL,
                name varchar(128) DEFAULT NULL,
                `type` varchar(32) DEFAULT NULL,
                exchange varchar(16) DEFAULT NULL,
                market varchar(16) DEFAULT NULL,
                list_date date DEFAULT NULL,
                source varchar(32) DEFAULT NULL,
                created_at datetime DEFAULT CURRENT_TIMESTAMP,
                updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ts_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """,
            """
            CREATE TABLE IF NOT EXISTS ths_member (
                id bigint NOT NULL AUTO_INCREMENT,
                ts_code varchar(32) NOT NULL,
                con_code varchar(32) NOT NULL,
                source varchar(32) DEFAULT NULL,
                created_at datetime DEFAULT CURRENT_TIMESTAMP,
                updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_ths_member_board_constituent (ts_code, con_code),
                KEY idx_ths_member_con_code (con_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """,
            """
            CREATE TABLE IF NOT EXISTS tushare_raw_data (
                id bigint NOT NULL AUTO_INCREMENT,
                dataset_key varchar(64) NOT NULL,
                scope_key varchar(128) DEFAULT NULL,
                ts_code varchar(32) DEFAULT NULL,
                entity_key varchar(64) DEFAULT NULL,
                trade_date date DEFAULT NULL,
                end_date date DEFAULT NULL,
                ann_date date DEFAULT NULL,
                raw_json longtext DEFAULT NULL,
                update_time datetime DEFAULT CURRENT_TIMESTAMP,
                source varchar(64) DEFAULT NULL,
                dedupe_key varchar(255) NOT NULL,
                created_at datetime DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_tushare_raw_data_dedupe (dedupe_key),
                KEY idx_tushare_raw_data_lookup (dataset_key, ts_code, trade_date, end_date, ann_date),
                KEY idx_tushare_raw_data_scope (dataset_key, scope_key),
                KEY idx_tushare_raw_data_entity (dataset_key, entity_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """,
            """
            CREATE TABLE IF NOT EXISTS stock_fina_indicator (
                id bigint NOT NULL AUTO_INCREMENT,
                ts_code varchar(32) NOT NULL,
                ann_date date DEFAULT NULL,
                f_ann_date date DEFAULT NULL,
                end_date date DEFAULT NULL,
                report_type varchar(32) DEFAULT NULL,
                comp_type varchar(32) DEFAULT NULL,
                end_type varchar(32) DEFAULT NULL,
                raw_json longtext DEFAULT NULL,
                update_time datetime DEFAULT CURRENT_TIMESTAMP,
                source varchar(64) DEFAULT NULL,
                dedupe_key varchar(255) NOT NULL,
                created_at datetime DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_stock_fina_indicator_dedupe (dedupe_key),
                KEY idx_stock_fina_indicator_lookup (ts_code, end_date, ann_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """,
            """
            CREATE TABLE IF NOT EXISTS quant_task_runs (
                job_id varchar(64) NOT NULL,
                job_name varchar(64) NOT NULL,
                job_mode varchar(32) NOT NULL,
                status varchar(32) NOT NULL,
                started_at datetime NOT NULL,
                finished_at datetime DEFAULT NULL,
                log_path varchar(512) DEFAULT NULL,
                payload_json longtext DEFAULT NULL,
                created_at datetime DEFAULT CURRENT_TIMESTAMP,
                updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (job_id),
                KEY idx_quant_task_runs_mode_started (job_mode, started_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """,
            """
            CREATE TABLE IF NOT EXISTS quant_strategy_reports (
                report_id varchar(64) NOT NULL,
                report_date date NOT NULL,
                report_type varchar(64) NOT NULL,
                preset varchar(32) DEFAULT NULL,
                generated_at datetime NOT NULL,
                summary_text text DEFAULT NULL,
                payload_json longtext DEFAULT NULL,
                created_at datetime DEFAULT CURRENT_TIMESTAMP,
                updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (report_id),
                UNIQUE KEY uk_quant_strategy_reports_daily (report_date, report_type, preset)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """,
        ]
        for ddl in ddl_statements:
            self._execute(ddl)

    def _start_run_record(self) -> str:
        self._execute(
            """
            INSERT INTO quant_task_runs (job_id, job_name, job_mode, status, started_at, log_path)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                self.context.job_id,
                "local_quant_pipeline",
                self.args.mode,
                "running",
                self.run_started_at.strftime("%Y-%m-%d %H:%M:%S"),
                str(self.log_path),
            ),
        )
        return self.context.job_id

    def _finish_run_record(self, run_record: str, status: str, payload: dict[str, Any]) -> None:
        self._execute(
            """
            UPDATE quant_task_runs
            SET status = %s,
                finished_at = %s,
                payload_json = %s
            WHERE job_id = %s
            """,
            (
                status,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                json.dumps(payload, ensure_ascii=False),
                run_record,
            ),
        )

    def _run_unadjusted_import(self) -> dict[str, Any]:
        end_date = self.context.today.strftime("%Y%m%d")
        script_path = self.context.root_dir / "sync_unadjusted_local_csv.py"
        command = [
            sys.executable,
            str(script_path),
            "--db-host",
            self.args.db_host,
            "--db-port",
            str(self.args.db_port),
            "--db-user",
            self.args.db_user,
            "--db-password",
            self.args.db_password,
            "--db-name",
            self.args.db_name,
            "--source-dir",
            self.args.source_dir,
            "--target-table",
            f"stock_daily_unadjusted_{self.context.today.year}",
            "--template-table",
            self.args.unadjusted_template_table,
            "--start-date",
            f"{self.context.today.year}0101",
            "--end-date",
            end_date,
        ]
        self.logger.info("Running local CSV import: %s", " ".join(command))
        result = subprocess.run(
            command,
            cwd=self.context.root_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
        )
        stdout_tail = "\n".join(result.stdout.splitlines()[-15:])
        stderr_tail = "\n".join(result.stderr.splitlines()[-15:])
        return {
            "ok": result.returncode == 0,
            "returnCode": result.returncode,
            "stdoutTail": stdout_tail,
            "stderrTail": stderr_tail,
        }

    def _run_tushare_enhanced_sync(self) -> dict[str, Any]:
        script_path = self.context.root_dir / "run_tushare_local_sync.py"
        sync_mode = "weekend" if self.args.mode == "weekend" else "daily"
        command = [
            sys.executable,
            str(script_path),
            "--mode",
            sync_mode,
            "--db-host",
            self.args.db_host,
            "--db-port",
            str(self.args.db_port),
            "--db-user",
            self.args.db_user,
            "--db-password",
            self.args.db_password,
            "--db-name",
            self.args.db_name,
            "--tushare-http-url",
            self.args.tushare_http_url,
        ]
        if self.args.tushare_token:
            command.extend(["--tushare-token", self.args.tushare_token])

        self.logger.info("Running Tushare enhanced sync: %s", " ".join(command[:4]) + " ...")
        result = subprocess.run(
            command,
            cwd=self.context.root_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
        )
        stdout_tail = "\n".join(result.stdout.splitlines()[-20:])
        stderr_tail = "\n".join(result.stderr.splitlines()[-20:])
        payload = {
            "ok": result.returncode == 0,
            "returnCode": result.returncode,
            "mode": sync_mode,
            "stdoutTail": stdout_tail,
            "stderrTail": stderr_tail,
        }
        if result.returncode != 0:
            raise RuntimeError("Tushare enhanced sync failed")
        return payload

    def _refresh_stock_basic(self) -> dict[str, Any]:
        price_table = self._resolve_latest_unadjusted_table()
        latest_rows = self._fetch_all(
            f"""
            SELECT
                p.symbol,
                p.name,
                p.industry,
                p.listing_date,
                p.delisting_date,
                p.trade_date
            FROM `{price_table}` p
            INNER JOIN (
                SELECT symbol, MAX(trade_date) AS max_trade_date
                FROM `{price_table}`
                WHERE symbol IS NOT NULL
                  AND symbol <> ''
                GROUP BY symbol
            ) latest
                ON latest.symbol = p.symbol
               AND latest.max_trade_date = p.trade_date
            """
        )
        payloads: list[tuple[Any, ...]] = []
        for row in latest_rows:
            symbol = str(row.get("symbol") or "").strip().zfill(6)
            if not symbol:
                continue
            ts_code = self._to_ts_code(symbol)
            exchange, market = self._infer_exchange_market(symbol)
            delist_date = row.get("delisting_date")
            list_status = "D" if delist_date else "L"
            payloads.append(
                (
                    ts_code,
                    symbol,
                    row.get("name"),
                    row.get("name"),
                    None,
                    exchange,
                    market,
                    row.get("industry"),
                    None,
                    list_status,
                    row.get("listing_date"),
                    delist_date,
                    None,
                    "CNY",
                    None,
                    None,
                )
            )
        affected_rows = self._executemany(
            """
            INSERT INTO stock_basic (
                ts_code, symbol, name, fullname, enname, exchange, market, industry, area,
                list_status, list_date, delist_date, is_hs, curr_type, act_name, act_ent_type
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                symbol = VALUES(symbol),
                name = VALUES(name),
                fullname = VALUES(fullname),
                exchange = VALUES(exchange),
                market = VALUES(market),
                industry = VALUES(industry),
                list_status = VALUES(list_status),
                list_date = VALUES(list_date),
                delist_date = VALUES(delist_date),
                curr_type = VALUES(curr_type)
            """,
            payloads,
        )
        return {
            "ok": True,
            "sourceTable": price_table,
            "rowCount": len(latest_rows),
            "affectedRows": affected_rows,
        }

    def _sync_industry_boards(self) -> dict[str, Any]:
        boards = ak.stock_board_industry_name_em()
        board_name_column = self._find_column(boards.columns, CN_BOARD_NAME)
        board_code_column = self._find_column(boards.columns, CN_BOARD_CODE)
        if board_name_column is None or board_code_column is None:
            raise RuntimeError("Unable to locate board columns from Eastmoney industry board dataset.")

        board_payloads: list[tuple[Any, ...]] = []
        member_payloads: list[tuple[Any, ...]] = []
        board_count = 0
        member_count = 0

        for _, board_row in boards.iterrows():
            board_name = self._normalize_text(board_row.get(board_name_column))
            board_code = self._normalize_text(board_row.get(board_code_column))
            if not board_name or not board_code:
                continue

            board_payloads.append((board_code, board_name, "EM_INDUSTRY", "EM", "A", None, "eastmoney"))
            board_count += 1

            try:
                constituents = ak.stock_board_industry_cons_em(symbol=board_name)
            except Exception as exc:
                self.logger.warning("Industry board constituent sync failed: board=%s error=%s", board_name, exc)
                continue

            code_column = self._find_column(constituents.columns, CN_CODE)
            if code_column is None:
                continue

            for _, item in constituents.iterrows():
                symbol = str(item.get(code_column) or "").strip().zfill(6)
                if not symbol:
                    continue
                member_payloads.append((board_code, self._to_ts_code(symbol), "eastmoney"))
                member_count += 1

        if board_payloads:
            self._executemany(
                """
                INSERT INTO ths_index (ts_code, name, `type`, exchange, market, list_date, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    `type` = VALUES(`type`),
                    exchange = VALUES(exchange),
                    market = VALUES(market),
                    source = VALUES(source)
                """,
                board_payloads,
            )
        if member_payloads:
            self._executemany(
                """
                INSERT INTO ths_member (ts_code, con_code, source)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    source = VALUES(source)
                """,
                member_payloads,
            )
        return {
            "ok": True,
            "boardCount": board_count,
            "memberCount": member_count,
        }

    def _sync_daily_basic_from_spot(self) -> dict[str, Any]:
        spot = ak.stock_zh_a_spot_em()
        code_column = self._find_column(spot.columns, CN_CODE)
        name_column = self._find_column(spot.columns, CN_NAME)
        if code_column is None or name_column is None:
            raise RuntimeError("Unable to locate stock code and name columns from spot snapshot dataset.")

        payloads: list[tuple[Any, ...]] = []
        for _, row in spot.iterrows():
            symbol = str(row.get(code_column) or "").strip().zfill(6)
            if not symbol:
                continue
            ts_code = self._to_ts_code(symbol)
            raw_payload = {
                "ts_code": ts_code,
                "symbol": symbol,
                "name": self._normalize_text(row.get(name_column)),
                "close": self._to_float(row.get("\u6700\u65b0\u4ef7")),
                "pct_chg": self._to_float(row.get("\u6da8\u8dcc\u5e45")),
                "turnover_rate": self._to_float(row.get("\u6362\u624b\u7387")),
                "volume_ratio": self._to_float(row.get("\u91cf\u6bd4")),
                "pe_ttm": self._to_float(row.get("\u5e02\u76c8\u7387-\u52a8\u6001")),
                "pb": self._to_float(row.get("\u5e02\u51c0\u7387")),
                "total_mv": self._scale_yuan_to_w(row.get("\u603b\u5e02\u503c")),
                "circ_mv": self._scale_yuan_to_w(row.get("\u6d41\u901a\u5e02\u503c")),
                "amount_yuan": self._to_float(row.get("\u6210\u4ea4\u989d")),
                "volume_shares": self._to_float(row.get("\u6210\u4ea4\u91cf")),
                "amplitude": self._to_float(row.get("\u632f\u5e45")),
                "high": self._to_float(row.get("\u6700\u9ad8")),
                "low": self._to_float(row.get("\u6700\u4f4e")),
                "open": self._to_float(row.get("\u4eca\u5f00")),
                "pre_close": self._to_float(row.get("\u6628\u6536")),
                "speed": self._to_float(row.get("\u6da8\u901f")),
                "five_min_pct": self._to_float(row.get("5\u5206\u949f\u6da8\u8dcc")),
                "sixty_day_pct": self._to_float(row.get("60\u65e5\u6da8\u8dcc\u5e45")),
                "ytd_pct": self._to_float(row.get("\u5e74\u521d\u81f3\u4eca\u6da8\u8dcc\u5e45")),
                "source": "eastmoney_spot",
            }
            payloads.append(
                self._raw_dataset_tuple(
                    dataset_key="daily_basic",
                    scope_key=ts_code,
                    ts_code=ts_code,
                    entity_key=symbol,
                    trade_date=self.context.today,
                    end_date=None,
                    ann_date=None,
                    raw_payload=raw_payload,
                    source="akshare.eastmoney.spot",
                    dedupe_key=f"daily_basic|{ts_code}|{self.context.today.isoformat()}",
                )
            )

        affected_rows = self._insert_raw_datasets(payloads)
        return {
            "ok": True,
            "rowCount": len(payloads),
            "affectedRows": affected_rows,
        }

    def _sync_moneyflow_ranks(self) -> dict[str, Any]:
        indicator_specs = {
            "\u4eca\u65e5": ("moneyflow", "today"),
            "3\u65e5": ("moneyflow_3d", "3d"),
            "5\u65e5": ("moneyflow_5d", "5d"),
            "10\u65e5": ("moneyflow_10d", "10d"),
        }
        totals: dict[str, Any] = {
            "ok": True,
            "datasets": {},
        }
        for indicator, (dataset_key, scope_key) in indicator_specs.items():
            frame = ak.stock_individual_fund_flow_rank(indicator=indicator)
            code_column = self._find_column(frame.columns, CN_CODE)
            name_column = self._find_column(frame.columns, CN_NAME)
            if code_column is None or name_column is None:
                raise RuntimeError(f"Unable to locate moneyflow columns for indicator={indicator}")

            prefix = indicator
            payloads: list[tuple[Any, ...]] = []
            sample_rows: list[dict[str, Any]] = []
            for _, row in frame.iterrows():
                symbol = str(row.get(code_column) or "").strip().zfill(6)
                if not symbol:
                    continue
                ts_code = self._to_ts_code(symbol)
                raw_payload = {
                    "ts_code": ts_code,
                    "symbol": symbol,
                    "name": self._normalize_text(row.get(name_column)),
                    "window": scope_key,
                    "close": self._to_float(row.get("\u6700\u65b0\u4ef7")),
                    "pct_chg": self._to_float(row.get(f"{prefix}\u6da8\u8dcc\u5e45")),
                    "net_mf_amount": self._scale_yuan_to_w(row.get(f"{prefix}\u4e3b\u529b\u51c0\u6d41\u5165-\u51c0\u989d")),
                    "net_mf_ratio": self._to_float(row.get(f"{prefix}\u4e3b\u529b\u51c0\u6d41\u5165-\u51c0\u5360\u6bd4")),
                    "buy_elg_amount": self._scale_yuan_to_w(row.get(f"{prefix}\u8d85\u5927\u5355\u51c0\u6d41\u5165-\u51c0\u989d")),
                    "buy_elg_ratio": self._to_float(row.get(f"{prefix}\u8d85\u5927\u5355\u51c0\u6d41\u5165-\u51c0\u5360\u6bd4")),
                    "buy_lg_amount": self._scale_yuan_to_w(row.get(f"{prefix}\u5927\u5355\u51c0\u6d41\u5165-\u51c0\u989d")),
                    "buy_lg_ratio": self._to_float(row.get(f"{prefix}\u5927\u5355\u51c0\u6d41\u5165-\u51c0\u5360\u6bd4")),
                    "sell_md_amount": self._scale_yuan_to_w(row.get(f"{prefix}\u4e2d\u5355\u51c0\u6d41\u5165-\u51c0\u989d")),
                    "sell_md_ratio": self._to_float(row.get(f"{prefix}\u4e2d\u5355\u51c0\u6d41\u5165-\u51c0\u5360\u6bd4")),
                    "sell_sm_amount": self._scale_yuan_to_w(row.get(f"{prefix}\u5c0f\u5355\u51c0\u6d41\u5165-\u51c0\u989d")),
                    "sell_sm_ratio": self._to_float(row.get(f"{prefix}\u5c0f\u5355\u51c0\u6d41\u5165-\u51c0\u5360\u6bd4")),
                    "source": "eastmoney_fund_flow_rank",
                }
                payloads.append(
                    self._raw_dataset_tuple(
                        dataset_key=dataset_key,
                        scope_key=scope_key,
                        ts_code=ts_code,
                        entity_key=symbol,
                        trade_date=self.context.today,
                        end_date=None,
                        ann_date=None,
                        raw_payload=raw_payload,
                        source="akshare.eastmoney.fund_flow_rank",
                        dedupe_key=f"{dataset_key}|{ts_code}|{self.context.today.isoformat()}",
                    )
                )
                if len(sample_rows) < 5:
                    sample_rows.append(
                        {
                            "symbol": symbol,
                            "name": raw_payload["name"],
                            "net_mf_amount_w": raw_payload["net_mf_amount"],
                            "pct_chg": raw_payload["pct_chg"],
                        }
                    )
            affected_rows = self._insert_raw_datasets(payloads)
            totals["datasets"][scope_key] = {
                "rowCount": len(payloads),
                "affectedRows": affected_rows,
                "sample": sample_rows,
            }
        return totals

    def _sync_content_datasets(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "ok": True,
            "cctvNews": {"rowCount": 0, "affectedRows": 0},
            "stockNotices": {"rowCount": 0, "affectedRows": 0},
        }

        cctv_payloads: list[tuple[Any, ...]] = []
        try:
            cctv_news = ak.news_cctv(date=self.context.today.strftime("%Y%m%d"))
        except Exception as exc:
            self.logger.warning("CCTV news sync failed: %s", exc)
            cctv_news = pd.DataFrame()

        if not cctv_news.empty:
            title_column = self._find_column(cctv_news.columns, "\u6807\u9898")
            content_column = self._find_column(cctv_news.columns, "\u5185\u5bb9")
            date_column = self._find_column(cctv_news.columns, CN_DATE)
            for _, row in cctv_news.iterrows():
                title = self._normalize_text(row.get(title_column)) if title_column else None
                content = self._normalize_text(row.get(content_column)) if content_column else None
                item_date = self._to_date(row.get(date_column)) if date_column else self.context.today
                payload = {
                    "title": title,
                    "content": content,
                    "date": item_date.isoformat() if item_date else self.context.today.isoformat(),
                    "source": "cctv",
                }
                dedupe = self._hash_text(f"cctv|{payload['date']}|{title}|{content}")
                cctv_payloads.append(
                    self._raw_dataset_tuple(
                        dataset_key="cctv_news",
                        scope_key=payload["date"],
                        ts_code=None,
                        entity_key=dedupe,
                        trade_date=item_date,
                        end_date=None,
                        ann_date=None,
                        raw_payload=payload,
                        source="akshare.cctv",
                        dedupe_key=f"cctv_news|{dedupe}",
                    )
                )
        if cctv_payloads:
            result["cctvNews"]["rowCount"] = len(cctv_payloads)
            result["cctvNews"]["affectedRows"] = self._insert_raw_datasets(cctv_payloads)

        notice_payloads: list[tuple[Any, ...]] = []
        try:
            notices = ak.stock_notice_report(symbol="\u5168\u90e8", date=self.context.today.strftime("%Y%m%d"))
        except Exception as exc:
            self.logger.warning("Stock notice sync failed: %s", exc)
            notices = pd.DataFrame()

        if not notices.empty:
            code_column = self._find_column(notices.columns, CN_NOTICE_CODE) or self._find_column(notices.columns, CN_CODE)
            name_column = self._find_column(notices.columns, CN_NOTICE_NAME) or self._find_column(notices.columns, CN_NAME)
            title_column = self._find_column(notices.columns, CN_NOTICE_TITLE) or self._find_column(notices.columns, "\u516c\u544a\u540d\u79f0")
            url_column = self._find_column(notices.columns, CN_NOTICE_URL) or self._find_column(notices.columns, "\u94fe\u63a5")
            date_column = self._find_column(notices.columns, CN_NOTICE_DATE) or self._find_column(notices.columns, CN_DATE)
            for _, row in notices.iterrows():
                symbol = str(row.get(code_column) or "").strip().zfill(6) if code_column else ""
                ts_code = self._to_ts_code(symbol) if symbol else None
                ann_date = self._to_date(row.get(date_column)) if date_column else self.context.today
                title = self._normalize_text(row.get(title_column)) if title_column else None
                raw_payload = {
                    "ts_code": ts_code,
                    "symbol": symbol or None,
                    "name": self._normalize_text(row.get(name_column)) if name_column else None,
                    "title": title,
                    "url": self._normalize_text(row.get(url_column)) if url_column else None,
                    "ann_date": ann_date.isoformat() if ann_date else self.context.today.isoformat(),
                    "source": "eastmoney_notice",
                }
                dedupe = self._hash_text(f"notice|{ts_code}|{ann_date}|{title}|{raw_payload['url']}")
                notice_payloads.append(
                    self._raw_dataset_tuple(
                        dataset_key="stock_notice",
                        scope_key=raw_payload["ann_date"],
                        ts_code=ts_code,
                        entity_key=symbol or dedupe,
                        trade_date=None,
                        end_date=None,
                        ann_date=ann_date,
                        raw_payload=raw_payload,
                        source="akshare.eastmoney.notice",
                        dedupe_key=f"stock_notice|{dedupe}",
                    )
                )
        if notice_payloads:
            result["stockNotices"]["rowCount"] = len(notice_payloads)
            result["stockNotices"]["affectedRows"] = self._insert_raw_datasets(notice_payloads)

        return result

    def _sync_financial_indicators(self) -> dict[str, Any]:
        report_dates = self._build_report_dates()
        totals: dict[str, Any] = {
            "ok": True,
            "reportDates": report_dates,
            "datasets": {},
        }
        for report_date in report_dates:
            try:
                frame = ak.stock_yjbb_em(date=report_date)
            except Exception as exc:
                self.logger.warning("Financial report sync failed: report_date=%s error=%s", report_date, exc)
                totals["datasets"][report_date] = {"ok": False, "error": str(exc)}
                continue

            payloads: list[tuple[Any, ...]] = []
            count = 0
            for _, row in frame.iterrows():
                symbol = str(row.get("\u80a1\u7968\u4ee3\u7801") or "").strip().zfill(6)
                if not symbol:
                    continue
                ts_code = self._to_ts_code(symbol)
                ann_date = self._to_date(row.get("\u6700\u65b0\u516c\u544a\u65e5\u671f")) or self.context.today
                end_date = datetime.strptime(report_date, "%Y%m%d").date()
                raw_payload = {
                    "ts_code": ts_code,
                    "symbol": symbol,
                    "name": self._normalize_text(row.get("\u80a1\u7968\u7b80\u79f0")),
                    "eps": self._to_float(row.get("\u6bcf\u80a1\u6536\u76ca")),
                    "or_yoy": self._to_float(row.get("\u8425\u4e1a\u603b\u6536\u5165-\u540c\u6bd4\u589e\u957f")),
                    "tr_yoy": self._to_float(row.get("\u8425\u4e1a\u603b\u6536\u5165-\u540c\u6bd4\u589e\u957f")),
                    "netprofit_yoy": self._to_float(row.get("\u51c0\u5229\u6da6-\u540c\u6bd4\u589e\u957f")),
                    "roe": self._to_float(row.get("\u51c0\u8d44\u4ea7\u6536\u76ca\u7387")),
                    "grossprofit_margin": self._to_float(row.get("\u9500\u552e\u6bdb\u5229\u7387")),
                    "ocfps": self._to_float(row.get("\u6bcf\u80a1\u7ecf\u8425\u73b0\u91d1\u6d41\u91cf")),
                    "industry": self._normalize_text(row.get("\u6240\u5904\u884c\u4e1a")),
                    "revenue": self._to_float(row.get("\u8425\u4e1a\u603b\u6536\u5165-\u8425\u4e1a\u603b\u6536\u5165")),
                    "profit": self._to_float(row.get("\u51c0\u5229\u6da6-\u51c0\u5229\u6da6")),
                    "source": "eastmoney_yjbb",
                }
                payloads.append(
                    (
                        ts_code,
                        ann_date,
                        ann_date,
                        end_date,
                        "yjbb_em",
                        None,
                        None,
                        json.dumps(raw_payload, ensure_ascii=False),
                        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "akshare.eastmoney.yjbb",
                        f"stock_fina_indicator|{ts_code}|{report_date}|yjbb_em",
                    )
                )
                count += 1

            affected_rows = self._executemany(
                """
                INSERT INTO stock_fina_indicator (
                    ts_code, ann_date, f_ann_date, end_date, report_type, comp_type,
                    end_type, raw_json, update_time, source, dedupe_key
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                )
                ON DUPLICATE KEY UPDATE
                    raw_json = VALUES(raw_json),
                    update_time = VALUES(update_time),
                    source = VALUES(source),
                    ann_date = VALUES(ann_date),
                    f_ann_date = VALUES(f_ann_date),
                    end_date = VALUES(end_date)
                """,
                payloads,
            )
            totals["datasets"][report_date] = {
                "ok": True,
                "rowCount": count,
                "affectedRows": affected_rows,
            }
        return totals

    def _run_analysis_reports(self) -> dict[str, Any]:
        os.environ["STOCK_DB_HOST"] = self.args.db_host
        os.environ["STOCK_DB_PORT"] = str(self.args.db_port)
        os.environ["STOCK_DB_USER"] = self.args.db_user
        os.environ["STOCK_DB_PASSWORD"] = self.args.db_password
        os.environ["STOCK_DB_NAME"] = self.args.db_name
        os.environ["QUANT_DISPLAY_PRICE_SOURCE"] = "unadjusted"
        os.environ["QUANT_SIGNAL_PRICE_SOURCE"] = "unadjusted"
        os.environ["QUANT_DEFAULT_SYMBOL"] = self.args.default_symbol

        if str(self.context.root_dir) not in sys.path:
            sys.path.insert(0, str(self.context.root_dir))

        from src.services.snapshot import snapshot_service

        result: dict[str, Any] = {
            "ok": True,
            "reports": {},
        }
        for preset in self.args.report_presets:
            report_type = "daily_screener"
            screener = snapshot_service.build_screener(
                top=self.args.screener_top,
                max_symbols=self.args.max_symbols,
                preset=preset,
            )
            self._upsert_strategy_report(report_type=report_type, preset=preset, payload=screener)
            result["reports"][preset] = {
                "screenedCount": screener.get("screenedCount"),
                "eligibleCount": screener.get("eligibleCount"),
                "qualifiedCount": screener.get("qualifiedCount"),
                "updatedAt": screener.get("updatedAt"),
            }

        result["marketBreadth"] = self._build_market_breadth()
        return result

    def _upsert_strategy_report(self, *, report_type: str, preset: str, payload: dict[str, Any]) -> None:
        summary_text = self._summarize_screener_report(preset, payload)
        self._execute(
            """
            INSERT INTO quant_strategy_reports (
                report_id, report_date, report_type, preset, generated_at, summary_text, payload_json
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                generated_at = VALUES(generated_at),
                summary_text = VALUES(summary_text),
                payload_json = VALUES(payload_json),
                report_id = VALUES(report_id)
            """,
            (
                uuid.uuid4().hex,
                self.context.today,
                report_type,
                preset,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                summary_text,
                json.dumps(payload, ensure_ascii=False),
            ),
        )

    def _build_market_breadth(self) -> dict[str, Any]:
        spot = ak.stock_zh_a_spot_em()
        pct_column = self._find_column(spot.columns, "\u6da8\u8dcc\u5e45")
        amount_column = self._find_column(spot.columns, "\u6210\u4ea4\u989d")
        code_column = self._find_column(spot.columns, CN_CODE)
        name_column = self._find_column(spot.columns, CN_NAME)
        latest_price_column = self._find_column(spot.columns, "\u6700\u65b0\u4ef7")

        up_count = 0
        down_count = 0
        flat_count = 0
        total_amount_yuan = 0.0
        ranked_rows: list[dict[str, Any]] = []
        for _, row in spot.iterrows():
            pct = self._to_float(row.get(pct_column)) if pct_column else None
            amount = self._to_float(row.get(amount_column)) if amount_column else None
            if pct is not None:
                if pct > 0:
                    up_count += 1
                elif pct < 0:
                    down_count += 1
                else:
                    flat_count += 1
            if amount is not None:
                total_amount_yuan += amount
            ranked_rows.append(
                {
                    "symbol": str(row.get(code_column) or "").strip(),
                    "name": self._normalize_text(row.get(name_column)),
                    "latestPrice": self._to_float(row.get(latest_price_column)) if latest_price_column else None,
                    "pctChg": pct,
                    "amountYuan": amount,
                }
            )
        top_gainers = sorted(ranked_rows, key=lambda item: item.get("pctChg") or -9999, reverse=True)[:10]
        top_turnover = sorted(ranked_rows, key=lambda item: item.get("amountYuan") or 0.0, reverse=True)[:10]
        return {
            "tradeDate": self.context.today.strftime("%Y-%m-%d"),
            "upCount": up_count,
            "downCount": down_count,
            "flatCount": flat_count,
            "totalAmountYuan": round(total_amount_yuan, 2),
            "topGainers": top_gainers,
            "topTurnover": top_turnover,
        }

    def _write_outputs(self, payload: dict[str, Any]) -> None:
        self.report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self.summary_path.write_text(self._render_summary_markdown(payload), encoding="utf-8")

    def _build_summary(self, payload: dict[str, Any]) -> dict[str, Any]:
        analysis = payload.get("steps", {}).get("analysis", {})
        market_breadth = analysis.get("marketBreadth") or {}
        reports = analysis.get("reports") or {}
        return {
            "reportPath": str(self.report_path),
            "summaryPath": str(self.summary_path),
            "logPath": str(self.log_path),
            "upCount": market_breadth.get("upCount"),
            "downCount": market_breadth.get("downCount"),
            "reportPresets": {
                preset: {
                    "qualifiedCount": item.get("qualifiedCount"),
                    "screenedCount": item.get("screenedCount"),
                }
                for preset, item in reports.items()
            },
        }

    def _render_summary_markdown(self, payload: dict[str, Any]) -> str:
        lines = [
            f"# {self.context.today.strftime('%Y-%m-%d')} \u91cf\u5316\u65e5\u62a5",
            "",
            f"- \u4efb\u52a1 ID: `{self.context.job_id}`",
            f"- \u6a21\u5f0f: `{self.args.mode}`",
            f"- \u65e5\u5fd7: `{self.log_path}`",
            f"- \u8be6\u7ec6 JSON: `{self.report_path}`",
            "",
        ]
        market_breadth = (payload.get("steps", {}).get("analysis", {}) or {}).get("marketBreadth") or {}
        if market_breadth:
            lines.extend(
                [
                    "## \u5e02\u573a\u5bbd\u5ea6",
                    "",
                    f"- \u4e0a\u6da8\u5bb6\u6570: {market_breadth.get('upCount')}",
                    f"- \u4e0b\u8dcc\u5bb6\u6570: {market_breadth.get('downCount')}",
                    f"- \u5e73\u76d8\u5bb6\u6570: {market_breadth.get('flatCount')}",
                    f"- \u5168\u5e02\u573a\u6210\u4ea4\u989d(\u5143): {market_breadth.get('totalAmountYuan')}",
                    "",
                ]
            )

        reports = (payload.get("steps", {}).get("analysis", {}) or {}).get("reports") or {}
        if reports:
            lines.append("## \u7b56\u7565\u7b5b\u9009")
            lines.append("")
            for preset, item in reports.items():
                lines.append(
                    f"- `{preset}`: screened={item.get('screenedCount')} eligible={item.get('eligibleCount')} qualified={item.get('qualifiedCount')}"
                )
            lines.append("")
        return "\n".join(lines)

    def _summarize_screener_report(self, preset: str, payload: dict[str, Any]) -> str:
        return (
            f"preset={preset}; screened={payload.get('screenedCount')}; "
            f"eligible={payload.get('eligibleCount')}; qualified={payload.get('qualifiedCount')}; "
            f"updatedAt={payload.get('updatedAt')}"
        )

    def _insert_raw_datasets(self, payloads: list[tuple[Any, ...]]) -> int:
        return self._executemany(
            """
            INSERT INTO tushare_raw_data (
                dataset_key, scope_key, ts_code, entity_key, trade_date, end_date, ann_date,
                raw_json, update_time, source, dedupe_key
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            ON DUPLICATE KEY UPDATE
                scope_key = VALUES(scope_key),
                ts_code = VALUES(ts_code),
                entity_key = VALUES(entity_key),
                trade_date = VALUES(trade_date),
                end_date = VALUES(end_date),
                ann_date = VALUES(ann_date),
                raw_json = VALUES(raw_json),
                update_time = VALUES(update_time),
                source = VALUES(source)
            """,
            payloads,
        )

    def _raw_dataset_tuple(
        self,
        *,
        dataset_key: str,
        scope_key: str | None,
        ts_code: str | None,
        entity_key: str | None,
        trade_date: date | None,
        end_date: date | None,
        ann_date: date | None,
        raw_payload: dict[str, Any],
        source: str,
        dedupe_key: str,
    ) -> tuple[Any, ...]:
        return (
            dataset_key,
            scope_key,
            ts_code,
            entity_key,
            trade_date,
            end_date,
            ann_date,
            json.dumps(raw_payload, ensure_ascii=False),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            source,
            dedupe_key,
        )

    def _resolve_latest_unadjusted_table(self) -> str:
        current_table = f"stock_daily_unadjusted_{self.context.today.year}"
        row = self._fetch_one(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name = %s
            """,
            (self.args.db_name, current_table),
        )
        if row:
            return current_table

        latest = self._fetch_one(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_name REGEXP '^stock_daily_unadjusted_[0-9]{4}$'
            ORDER BY table_name DESC
            LIMIT 1
            """,
            (self.args.db_name,),
        )
        if not latest or not latest.get("table_name"):
            raise RuntimeError("No stock_daily_unadjusted_YYYY table was found in the local database.")
        return str(latest["table_name"])

    def _build_report_dates(self) -> list[str]:
        max_dates = 2 if self.args.mode == "daily" else 8
        dates: list[str] = []
        quarter_end = self._last_quarter_end(self.context.today)
        while len(dates) < max_dates:
            dates.append(quarter_end.strftime("%Y%m%d"))
            quarter_end = self._previous_quarter_end(quarter_end)
        return dates

    @staticmethod
    def _last_quarter_end(value: date) -> date:
        if value.month <= 3:
            return date(value.year - 1, 12, 31)
        if value.month <= 6:
            return date(value.year, 3, 31)
        if value.month <= 9:
            return date(value.year, 6, 30)
        return date(value.year, 9, 30)

    @staticmethod
    def _previous_quarter_end(value: date) -> date:
        previous_day = value - timedelta(days=1)
        return LocalQuantPipeline._last_quarter_end(previous_day)

    @staticmethod
    def _to_ts_code(symbol: str) -> str:
        symbol = str(symbol).strip().split(".", 1)[0].zfill(6)
        if symbol.startswith(("43", "83", "87", "88", "92")):
            suffix = "BJ"
        elif symbol.startswith(("50", "51", "58", "60", "68", "90")):
            suffix = "SH"
        else:
            suffix = "SZ"
        return f"{symbol}.{suffix}"

    @staticmethod
    def _infer_exchange_market(symbol: str) -> tuple[str, str]:
        if symbol.startswith(("43", "83", "87", "88", "92")):
            return "BSE", "BSE"
        if symbol.startswith(("50", "51", "58", "60", "68", "90")):
            return "SSE", "SH"
        return "SZSE", "SZ"

    @staticmethod
    def _normalize_text(value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        if text in {"", "-", "nan", "NaN", "None", "null"}:
            return None
        return text

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value in (None, "", "-", "nan", "NaN", "None", "null"):
            return None
        try:
            if pd.isna(value):
                return None
        except TypeError:
            pass
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _scale_yuan_to_w(value: Any) -> float | None:
        numeric = LocalQuantPipeline._to_float(value)
        if numeric is None:
            return None
        return round(numeric / 10000.0, 4)

    @staticmethod
    def _to_date(value: Any) -> date | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        text = str(value).strip()
        if text in {"", "-", "nan", "NaN", "None", "null"}:
            return None
        text = text.replace(" 00:00:00", "")
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue
        return None

    @staticmethod
    def _hash_text(value: str) -> str:
        return hashlib.sha1(value.encode("utf-8", errors="ignore")).hexdigest()

    @staticmethod
    def _find_column(columns: Any, expected: str) -> str | None:
        for column in columns:
            if str(column).strip() == expected:
                return str(column)
        return None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the local daily quant data pipeline.")
    parser.add_argument("--mode", choices=("daily", "weekend"), default="daily")
    parser.add_argument("--db-host", default=DEFAULT_DB_HOST)
    parser.add_argument("--db-port", type=int, default=DEFAULT_DB_PORT)
    parser.add_argument("--db-user", default=DEFAULT_DB_USER)
    parser.add_argument("--db-password", default=DEFAULT_DB_PASSWORD)
    parser.add_argument("--db-name", default=DEFAULT_DB_NAME)
    parser.add_argument("--source-dir", default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--unadjusted-template-table", default="stock_daily_unadjusted_2026")
    parser.add_argument("--default-symbol", default="")
    parser.add_argument("--screener-top", type=int, default=12)
    parser.add_argument("--max-symbols", type=int)
    parser.add_argument("--enable-tushare-sync", action="store_true")
    parser.add_argument("--tushare-token", default="")
    parser.add_argument("--tushare-http-url", default="http://tsy.xiaodefa.cn")
    parser.add_argument(
        "--report-presets",
        nargs="+",
        default=list(DEFAULT_REPORT_PRESETS),
        help="Screener presets to persist, e.g. balanced aggressive conservative",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    pipeline = LocalQuantPipeline(args)
    payload = pipeline.run()
    print(json.dumps(payload.get("summary") or {}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
