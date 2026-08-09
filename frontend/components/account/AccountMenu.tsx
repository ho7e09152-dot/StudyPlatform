"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useAppTheme } from "@/components/providers/AppThemeProvider";
import { Avatar } from "@/components/ui/Avatar";
import { logout } from "@/lib/api/services/authApi";
import type { StudyMember } from "@/lib/domain/types";

export function AccountMenu({ member, onOpenProfile }: { member: StudyMember; onOpenProfile: () => void }) {
  const { themeMode, setThemeMode, saving } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (open && rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
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
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenProfile();
              }}
            >
              <UserRound size={17} />
              <span><strong>프로필 설정</strong><small>이름과 강조 색상 변경</small></span>
            </button>
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
                    setError(requestError instanceof Error ? requestError.message : "테마를 저장하지 못했습니다.");
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
