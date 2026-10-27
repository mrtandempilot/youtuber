import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { ChannelAnalyzer } from "@/components/tools/ChannelAnalyzer";
import { getTool } from "@/lib/tools";

const tool = getTool("youtube-channel-analyzer");

export const metadata = toolMetadata(tool);

export default function Page() {
  return (
    <ToolPage tool={tool} wide>
      <ChannelAnalyzer />
    </ToolPage>
  );
}
