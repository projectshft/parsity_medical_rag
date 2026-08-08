import ChatUI from "../chat-ui";

export default function ToolsPage() {
  return <ChatUI endpoint="/api/chat-tools" badge="tool calling" />;
}
