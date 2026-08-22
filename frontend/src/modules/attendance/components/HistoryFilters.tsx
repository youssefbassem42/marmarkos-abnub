import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown } from "lucide-react";
import { apiClient } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AttendanceStatusValue } from "../types";

export interface HistoryFilterValues {
  from?: string;
  to?: string;
  user_id?: string;
  status?: AttendanceStatusValue | "";
}

interface HistoryFiltersProps {
  values: HistoryFilterValues;
  onChange: (values: HistoryFilterValues) => void;
}

interface UserOption {
  id: string;
  name: string;
}

async function fetchUsers(): Promise<UserOption[]> {
  const { data } = await apiClient.get<
    Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string;
    }>
  >("/users");
  return data.map((user) => ({
    id: user.id,
    name:
      `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email,
  }));
}

const STATUS_OPTIONS = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;

/** Any calendar date resolves to the Thursday of its meeting week. */
function thursdayOf(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const daysSinceThursday = (date.getUTCDay() - 4 + 7) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceThursday);
  return date.toISOString().slice(0, 10);
}

/** Filter bar: meeting range + member (ADMIN) + status. State lives in the URL. */
export function HistoryFilters({ values, onChange }: HistoryFiltersProps) {
  const { t } = useTranslation("attendance");
  const { t: tCommon } = useTranslation("common");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const inputClass = cn(
    "h-11 rounded-xl border-border focus-ring",
    isArabic && "font-arabic",
  );

  // Draft state: edits apply only on "Apply"; Reset clears everything.
  const [draft, setDraft] = useState<HistoryFilterValues>(values);
  useEffect(() => setDraft(values), [values]);

  // ADMIN-only member picker over GET /users.
  const isAdmin = getAuthUser()?.role === "ADMIN";
  const [memberOpen, setMemberOpen] = useState(false);
  const usersQuery = useQuery({
    queryKey: ["users", "options"],
    queryFn: fetchUsers,
    enabled: isAdmin,
  });
  const members = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const selectedMember = members.find((member) => member.id === draft.user_id);

  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_2px_24px_rgba(37,61,99,0.08)] sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1.5">
        <Label htmlFor="history-from">{t("history.filters.from")}</Label>
        <Input
          id="history-from"
          type="date"
          value={draft.from ?? ""}
          onChange={(event) =>
            setDraft((d) => ({
              ...d,
              from: thursdayOf(event.target.value) || undefined,
            }))
          }
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="history-to">{t("history.filters.to")}</Label>
        <Input
          id="history-to"
          type="date"
          value={draft.to ?? ""}
          onChange={(event) =>
            setDraft((d) => ({
              ...d,
              to: thursdayOf(event.target.value) || undefined,
            }))
          }
          className={inputClass}
        />
      </div>

      {isAdmin && (
        <div className="space-y-1.5">
          <Label>{t("history.filters.member")}</Label>
          <Popover open={memberOpen} onOpenChange={setMemberOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={memberOpen}
                className="h-11 w-full justify-between rounded-xl border-border font-normal focus-ring"
              >
                <span className="truncate">
                  {selectedMember?.name ?? t("history.filters.all")}
                </span>
                <ChevronsUpDown
                  className="ms-2 h-4 w-4 shrink-0 opacity-50"
                  aria-hidden="true"
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" dir={isArabic ? "rtl" : "ltr"}>
              <Command>
                <CommandInput placeholder={t("history.filters.member")} />
                <CommandList>
                  <CommandEmpty>
                    {usersQuery.isPending ? tCommon("loading") : "—"}
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value=""
                      onSelect={() => {
                        setDraft((d) => ({ ...d, user_id: undefined }));
                        setMemberOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "me-2 h-4 w-4",
                          !draft.user_id ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden="true"
                      />
                      {t("history.filters.all")}
                    </CommandItem>
                    {members.map((member) => (
                      <CommandItem
                        key={member.id}
                        value={member.name}
                        onSelect={() => {
                          setDraft((d) => ({ ...d, user_id: member.id }));
                          setMemberOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "me-2 h-4 w-4",
                            draft.user_id === member.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                          aria-hidden="true"
                        />
                        {member.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>{t("history.filters.status")}</Label>
        <Select
          value={draft.status || "ALL"}
          onValueChange={(value) =>
            setDraft((d) => ({
              ...d,
              status: value === "ALL" ? "" : (value as AttendanceStatusValue),
            }))
          }
        >
          <SelectTrigger className="h-11 rounded-xl border-border focus-ring">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("history.filters.all")}</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`status.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => {
            const next: HistoryFilterValues = {
              from: draft.from,
              to: draft.to,
              user_id: draft.user_id,
              status: draft.status,
            };
            if (
              next.from === values.from &&
              next.to === values.to &&
              next.user_id === values.user_id &&
              next.status === values.status
            )
              return;
            onChange(next);
          }}
          className="btn-primary h-11 flex-1 justify-center px-4 text-sm"
        >
          {t("history.filters.apply")}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft({});
            onChange({});
          }}
          className="btn-outline h-11 flex-1 justify-center px-4 text-sm"
        >
          <span className={isArabic ? "font-arabic" : undefined}>
            {t("history.filters.reset")}
          </span>
        </button>
      </div>
    </div>
  );
}
