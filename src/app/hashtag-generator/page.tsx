import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { HashtagGenerator } from "@/components/tools/HashtagGenerator";
import { getTool } from "@/lib/tools";

const tool = getTool("hashtag-generator");

export const metadata = toolMetadata(tool);

export default function Page() {
  return (
    <ToolPage tool={tool}>
      <HashtagGenerator />
    </ToolPage>
  );
}
