import { sessions } from "@shared/schema";
import "dotenv/config";
import { db } from "../server/db";

async function run() {
  try {
    const rows = await db
      .select()
      .from(sessions)
      .orderBy(sessions.expire)
      .limit(50);

    console.log(`Found ${rows.length} session(s) (showing up to 50)`);
    for (const r of rows) {
      const sess = (r as any).sess || {};
      const sid = (r as any).sid;
      const expire = (r as any).expire;
      const activeCompanyId = sess?.activeCompanyId;
      const userId = sess?.passport?.user?.id;
      console.log("---");
      console.log(`sid: ${sid}`);
      console.log(`expire: ${expire}`);
      console.log(`userId (sess.passport.user.id): ${userId}`);
      console.log(`activeCompanyId (sess.activeCompanyId): ${activeCompanyId}`);
      // Show first-level keys of sess
      console.log("sess keys:", Object.keys(sess));
      if (sess && typeof sess === "object") {
        // print only a few keys content
        const preview: any = {};
        for (const k of Object.keys(sess)) {
          preview[k] =
            typeof sess[k] === "object" ? "[object]" : String(sess[k]);
        }
        console.log("sess preview:", preview);
      }
    }
  } catch (err: any) {
    console.error("Error querying sessions:", err.message || err);
    process.exit(1);
  }
  process.exit(0);
}

run();
