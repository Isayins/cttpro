import { useMemo, useState } from "react";
import { AutoComplete, Input } from "antd";
import { DownOutlined, PlusOutlined } from "@ant-design/icons";

import type { GroupOption } from "./mailCodeHelpers";

export function EditableGroupSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: GroupOption[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [searchValue, setSearchValue] = useState("");
  const visibleOptions = useMemo(() => {
    const query = searchValue.trim();
    if (!query) {
      return options;
    }

    const normalizedQuery = query.toLocaleLowerCase("zh-CN");
    const matchedOptions = options.filter((option) =>
      option.value.toLocaleLowerCase("zh-CN").includes(normalizedQuery),
    );
    if (options.some((option) => option.value === query)) {
      return matchedOptions;
    }

    return [
      {
        label: (
          <span className="flex items-center gap-2">
            <PlusOutlined />
            新建分组“{query}”
          </span>
        ),
        value: query,
      },
      ...matchedOptions,
    ];
  }, [options, searchValue]);

  return (
    <AutoComplete
      allowClear
      className="w-full"
      filterOption={false}
      options={visibleOptions}
      suffixIcon={<DownOutlined />}
      value={value}
      onBlur={() => setSearchValue("")}
      onChange={(nextValue) => {
        onChange(nextValue);
        if (!nextValue) {
          setSearchValue("");
        }
      }}
      onFocus={() => setSearchValue("")}
      onSearch={setSearchValue}
      onSelect={() => setSearchValue("")}
    >
      <Input maxLength={80} showCount placeholder={placeholder} />
    </AutoComplete>
  );
}
