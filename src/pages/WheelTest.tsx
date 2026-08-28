import { useEffect, useRef, useState } from "react";

import { Card, CardContent } from "../components/ui";
import { getErrorMessage } from "../lib/errorMessage";
import { WheelToolPanel } from "./tools/WheelToolPanel";
import { buildWheelCsv, buildWheelSummary, clearWheelSession, downloadTextFile, findWheelDuplicateOptions, parseWheelOptions, readWheelSession, secureRandomFraction, secureRandomIndex, writeWheelSession } from "./tools/toolUtils";

export default function WheelTest() {
  const [session] = useState(() => readWheelSession());
  const [input, setInput] = useState(() => session?.options.join("\n") ?? "火锅\n烧烤\n日料\n家常菜\n披萨\n轻食");
  const [rotation, setRotation] = useState(() => session?.rotation ?? 0);
  const [selected, setSelected] = useState(() => session?.selected ?? "");
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>(() => session?.results ?? []);
  const [targetCount, setTargetCount] = useState(() => session?.targetCount ?? 10);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  useEffect(() => {
    const options = input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (options.length >= 2 && options.length <= 50 && findWheelDuplicateOptions(options).length === 0) {
      writeWheelSession({ options, results, targetCount, rotation, selected });
    } else {
      clearWheelSession();
    }
  }, [input, results, targetCount, rotation, selected]);

  const spin = () => {
    if (spinning || results.length >= targetCount) {
      return;
    }
    setError(null);
    try {
      const options = parseWheelOptions(input);
      const selectedIndex = secureRandomIndex(options.length);
      const landingOffset = 0.08 + secureRandomFraction() * 0.84;
      const segmentAngle = 360 / options.length;
      const normalizedRotation = ((rotation % 360) + 360) % 360;
      const targetRotation = (360 - (selectedIndex + landingOffset) * segmentAngle) % 360;
      const nextRotation = rotation + 360 * 6 + ((targetRotation - normalizedRotation + 360) % 360);

      setInput(options.join("\n"));
      setSelected("");
      setSpinning(true);
      setRotation(nextRotation);
      timerRef.current = window.setTimeout(() => {
        const nextResults = [...results, options[selectedIndex]];
        setSelected(options[selectedIndex]);
        setResults(nextResults);
        setSpinning(false);
        timerRef.current = null;
      }, 4800);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "转盘旋转失败"));
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5">
          <div className="text-sm font-medium text-pink-600">本地测试</div>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">随机转盘</h1>
        </div>
        <Card className="rounded-lg bg-white shadow-sm">
          <CardContent className="p-5 md:p-8">
            <WheelToolPanel
              input={input}
              rotation={rotation}
              selected={selected}
              spinning={spinning}
              error={error}
              results={results}
              targetCount={targetCount}
              summaryCopied={summaryCopied}
              onInputChange={(value) => {
                setInput(value);
                setSelected("");
                setError(null);
              }}
              onTargetCountChange={setTargetCount}
              onSpin={spin}
              onCopySummary={async () => {
                try {
                  await navigator.clipboard.writeText(buildWheelSummary(input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean), results, targetCount));
                  setSummaryCopied(true);
                  window.setTimeout(() => setSummaryCopied(false), 1800);
                } catch {
                  setError("复制失败，请检查浏览器剪贴板权限");
                }
              }}
              onExport={() => {
                const options = input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
                downloadTextFile(buildWheelCsv(options, results, targetCount), `转盘统计-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
              }}
              onResetResults={() => {
                setResults([]);
                setSelected("");
                setSummaryCopied(false);
              }}
              onClear={() => {
                setInput("");
                setSelected("");
                setRotation(0);
                setError(null);
                setResults([]);
                setSummaryCopied(false);
                clearWheelSession();
              }}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
