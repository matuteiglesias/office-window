import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownDocument({
  title,
  content,
  empty = "Missing artifact.",
}: {
  title?: string;
  content: string;
  empty?: string;
}) {
  return (
    <section className="markdown-card">
      {title ? <h2>{title}</h2> : null}
      {content.trim() ? (
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}
