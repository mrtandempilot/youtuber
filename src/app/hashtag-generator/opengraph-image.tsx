import { ogImage, ogSize } from "@/lib/og";
import { getTool } from "@/lib/tools";

const tool = getTool("hashtag-generator");

export const alt = tool.metaTitle;
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogImage(tool.name, tool.cardDescription);
}
