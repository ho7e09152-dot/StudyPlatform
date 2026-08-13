"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronUp, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useAppTheme } from "@/components/providers/AppThemeProvider";
import { Avatar } from "@/components/ui/Avatar";
import { logout } from "@/lib/api/services/authApi";
import type { StudyMember } from "@/lib/domain/types";
import { getUserFacingError } from "@/lib/api/errors";

export function AccountMenu({ member }: { member: StudyMember }) {
  const { themeMode, setThemeMode, saving } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (open && rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (open && event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <div className="account-menu-wrap" ref={rootRef}>
        {open ? (
          <div className="account-menu" role="menu">
            <div className="account-menu__identity">
              <Avatar member={member} />
              <span><strong>{member.displayName}</strong><small>@{member.username}</small></span>
            </div>
            <Link
              href="/settings/profile"
              role="menuitem"
              onClick={() => {
                setOpen(false);
              }}
            >
              <UserRound size={17} />
              <span><strong>프로필 설정</strong><small>이름과 개인 시간대 관리</small></span>
            </Link>
            <div className="account-theme-row">
              <span>{themeMode === "DARK" ? <Moon size={17} /> : <Sun size={17} />}<strong>화면 테마</strong></span>
              <button
                className="theme-switch"
                type="button"
                role="switch"
                aria-checked={themeMode === "DARK"}
                aria-label="다크 모드"
                disabled={saving}
                onClick={() => {
                  setError("");
                  void setThemeMode(themeMode === "DARK" ? "LIGHT" : "DARK").catch((requestError) => {
                    setError(getUserFacingError(requestError, "테마를 저장하지 못했습니다."));
                  });
                }}
              ><span /></button>
            </div>
            {error ? <p className="account-menu__error" role="alert">{error}</p> : null}
            <button
              className="account-menu__logout"
              type="button"
              role="menuitem"
              onClick={() => {
                void logout().finally(() => {
                  window.location.href = "/login";
                });
              }}
            >
              <LogOut size={17} />
              <span><strong>로그아웃</strong><small>현재 기기에서 세션 종료</small></span>
            </button>
          </div>
        ) : null}
        <button
          ref={triggerRef}
          type="button"
          className="account-row"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <Avatar member={member} />
          <span><strong>{member.displayName}</strong><small>@{member.username}</small></span>
          <ChevronUp className={open ? "is-open" : undefined} size={17} />
        </button>
      </div>
    </>
  );
}
