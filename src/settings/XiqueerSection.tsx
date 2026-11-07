import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PeriodTime, Settings } from "../types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/motion/card";
import { Button } from "@/components/motion/button";
import { Input } from "@/components/motion/input";
import { Choice } from "./Choice";
import { ToggleRow } from "./Field";

interface SchoolInfo {
  name: string;
  code: string;
}

interface TermInfo {
  code: string;
  name: string;
  current: boolean;
}

interface LoginResult {
  schoolName: string;
  userName: string;
  terms: TermInfo[];
}

interface ImportResult {
  weeks: number;
  sessions: number;
  periods: { index: number; start: string; end: string }[];
  warnings: string[];
}

interface XiqueerSectionProps {
  onChange: (patch: Partial<Settings>) => void;
  onImported: () => void;
}

/**
 * 喜鹊儿登录 → 学期列表 → 导入课表。
 * All controls are beUI parts; this file only arranges them.
 */
export function XiqueerSection({ onChange, onImported }: XiqueerSectionProps) {
  const [school, setSchool] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  const [suggestions, setSuggestions] = useState<SchoolInfo[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolInfo | null>(null);
  const [searching, setSearching] = useState(false);

  const [session, setSession] = useState<LoginResult | null>(null);
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  const searchTimer = useRef<number | null>(null);

  useEffect(() => {
    invoke<string>("xiqueer_app_version")
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  const search = useCallback(async (keyword: string) => {
    if (keyword.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const list = await invoke<SchoolInfo[]>("xiqueer_search_schools", { keyword });
      setSuggestions(list);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onSchoolChange = (value: string) => {
    setSchool(value);
    setSelectedSchool(null);
    setSession(null);
    setTerm("");
    setError(null);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => search(value), 400);
  };

  const login = async () => {
    if (!selectedSchool) {
      setError("请先搜索并选择学校");
      return;
    }
    if (!account.trim()) {
      setError("请填写账号");
      return;
    }
    if (!password) {
      setError("请填写密码");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await invoke<LoginResult>("xiqueer_login", {
        schoolCode: selectedSchool.code,
        schoolName: selectedSchool.name,
        account,
        password
      });
      setSession(result);
      const current = result.terms.find((item) => item.current) ?? result.terms[0];
      setTerm(current?.code ?? "");
      setMessage(
        result.terms.length
          ? `登录成功，共 ${result.terms.length} 个学期`
          : "登录成功，但没有可选学期"
      );
    } catch (err) {
      setSession(null);
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const importTerm = async () => {
    if (!session || !term) return;
    const target = session.terms.find((item) => item.code === term);
    setBusy(true);
    setError(null);
    setMessage("正在拉取课表，可能需要几十秒…");
    try {
      const result = await invoke<ImportResult>("xiqueer_import", {
        termCode: term,
        termName: target?.name ?? ""
      });

      if (result.periods.length) {
        const periods: PeriodTime[] = result.periods.map((slot) => ({
          index: slot.index,
          start: slot.start,
          end: slot.end
        }));
        onChange({ periods });
      }

      setMessage(
        `导入完成：${result.weeks} 周，${result.sessions} 节课` +
          (result.warnings.length ? `（${result.warnings.join("；")}）` : "")
      );
      onImported();
    } catch (err) {
      setMessage(null);
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const termOptions = (session?.terms ?? []).map((item) => ({
    value: item.code,
    label: item.current ? `${item.name}（当前学期）` : item.name || item.code
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">从喜鹊儿导入</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="relative flex flex-col gap-2">
          <Input
            label="学校"
            value={school}
            onChange={onSchoolChange}
            placeholder="输入学校名称，例如：郑州大学"
          />
          {selectedSchool ? (
            <p className="px-1 text-xs text-muted-foreground">
              已选择：{selectedSchool.name}（{selectedSchool.code}）
            </p>
          ) : searching ? (
            <p className="px-1 text-xs text-muted-foreground">搜索中…</p>
          ) : suggestions.length ? (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((item) => (
                <Button
                  key={item.code}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedSchool(item);
                    setSchool(item.name);
                    setSuggestions([]);
                    setSession(null);
                    setTerm("");
                  }}
                >
                  {item.name}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="账号"
            value={account}
            onChange={setAccount}
            placeholder="学号 / 工号"
          />
          <Input
            label="密码"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="登录密码"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={login} disabled={busy}>
            {session ? "重新登录" : "登录"}
          </Button>
          {version ? (
            <span className="text-xs text-muted-foreground">喜鹊儿版本 {version}</span>
          ) : null}
        </div>

        {session ? (
          <>
            <ToggleRow label="登录信息">
              <span className="text-sm text-muted-foreground">
                {session.schoolName || selectedSchool?.name}
                {session.userName ? ` · ${session.userName}` : ""}
              </span>
            </ToggleRow>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Choice
                  label="学期"
                  value={term}
                  onChange={setTerm}
                  options={termOptions}
                  placeholder="选择学期"
                />
              </div>
              <Button onClick={importTerm} disabled={busy || !term}>
                导入课表
              </Button>
            </div>
          </>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
