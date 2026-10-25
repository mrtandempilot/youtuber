import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { ThumbnailDownloader } from "@/components/tools/ThumbnailDownloader";
import { getTool } from "@/lib/tools";

const tool = getTool("youtube-thumbnail-downloader");

export const metadata = toolMetadata(tool);

export default function Page() {
  return (
    <ToolPage tool={tool}>
      <ThumbnailDownloader />
    </ToolPage>
  );
}
