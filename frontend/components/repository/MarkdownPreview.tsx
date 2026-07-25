"use client";

import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";

function MarkdownLink({
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  const isExternal = href?.startsWith("http://") || href?.startsWith("https://");

  return (
    <a
      {...props}
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

const components: Components = {
  a: MarkdownLink,
  table: ({ children, ...props }) => (
    <div className="markdown-table-scroll">
      <table {...props}>{children}</table>
    </div>
  ),
  img: ({ alt, ...props }) => (
    // Markdown 문서는 외부 이미지도 포함할 수 있으므로 지연 로딩합니다.
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={alt ?? ""} loading="lazy" />
  ),
  input: (props) => <input {...props} disabled />,
};

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="markdown-preview">
      <article className="markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkFrontmatter]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
