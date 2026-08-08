import ChatUI from "./chat-ui";

export default function Home() {
  return <ChatUI endpoint="/api/chat" badge="hand-rolled pipeline" />;
}
