import {describe,expect,it} from "vitest"
import {publicEpisodePageUrl,publicSiteOrigin} from "@/lib/podcast/publicUrls"
describe("public episode URLs",()=>{it("origin",()=>expect(publicSiteOrigin("https://d.example")).toBe("https://d.example"));it("episode",()=>expect(publicEpisodePageUrl("https://d.example","a")).toBe("https://d.example/episodes/a"));it("null",()=>expect(publicEpisodePageUrl(null,"a")).toBeNull())})
