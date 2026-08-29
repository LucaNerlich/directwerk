import {describe,expect,it} from "vitest"
import {publicArticlePageUrl,publicEpisodePageUrl,publicSiteOrigin} from "../src/urls/publicContentUrls"
describe("publicContentUrls",()=>{it("origin",()=>expect(publicSiteOrigin("https://d.example")).toBe("https://d.example"));it("episode",()=>expect(publicEpisodePageUrl("https://d.example","a")).toBe("https://d.example/episodes/a"));it("null",()=>expect(publicSiteOrigin(null)).toBeNull())})
