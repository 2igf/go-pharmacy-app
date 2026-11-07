import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb, closeDb } from "../server/db";
import { fetchRxNormRecords } from "../server/medication-knowledge/rxnorm";
import { applyKnowledgeImport, searchKnowledge, knowledgeDetail } from "../server/medication-knowledge/repository";

// No phone/production import: promotion requires separate approval and the admin API.
const target = new URL(process.env.DATABASE_URL ?? "mysql://invalid/invalid");
if (target.pathname !== "/go_pharmacy_test_completion" || !["127.0.0.1", "localhost"].includes(target.hostname))
  throw new Error("Independent completion staging database required");
const ids = ["161","5640","723","7804","11289","6809","202433","153010","198440","308191","860975","310798"];
try {
  const db = await getDb();
  const [actor] = await db.select().from(users).where(eq(users.openId,"test:admin"));
  if (!actor || actor.role !== "admin") throw new Error("Fictional staging administrator required");
  const batches = [];
  for (let at=0;at<ids.length;at+=6) {
    const fetched = await fetchRxNormRecords(ids.slice(at,at+6));
    batches.push(await applyKnowledgeImport(actor.id,{requestId:randomUUID(),sourceCode:"rxnorm",permissionReference:null,...fetched}));
  }
  const visible = await searchKnowledge({country:"international",q:"",limit:50});
  const details = await Promise.all(visible.map(row=>knowledgeDetail(row.id,"en")));
  const jordan = await searchKnowledge({country:"JO",q:"",limit:50});
  const report = {at:new Date().toISOString(),database:target.pathname.slice(1),source:"RxNorm non-proprietary HTTPS API",requestedIds:ids,batches,visibleCount:visible.length,jordanVerifiedCount:jordan.length,languages:["en"],clinicalLabelCount:details.reduce((n,d)=>n+d.labels.length,0),withForm:details.filter(d=>d.facts.dosageForm).length,withStrength:details.filter(d=>d.ingredients.some(i=>i.strength)).length,records:details.map(d=>({id:d.id,name:d.name,externalId:d.externalId,ingredients:d.ingredients,facts:d.facts,source:d.source}))};
  await writeFile("docs/evidence/customer-completion/knowledge-live.json",JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({visibleCount:visible.length,jordanVerifiedCount:jordan.length,applied:batches.reduce((n,b)=>n+b.applied,0),skipped:batches.reduce((n,b)=>n+b.skipped,0),withForm:report.withForm,withStrength:report.withStrength}));
} finally { await closeDb(); }
