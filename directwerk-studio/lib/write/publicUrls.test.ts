import {describe,expect,it} from "vitest"
import {publicArticlePageUrl} from "@/lib/write/publicUrls"
describe("publicArticlePageUrl",()=>{it("builds",()=>expect(publicArticlePageUrl("https://d.example","a")).toBe("https://d.example/articles/a"));it("null",()=>expect(publicArticlePageUrl(null,"a")).toBeNull())})
