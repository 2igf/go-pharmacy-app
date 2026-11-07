import { expect, it } from "vitest";
import { normalizeRxNorm } from "./medication-knowledge/rxnorm";
const c = (id:string,name:string,tty:string)=>({rxcui:id,name,tty,language:"ENG",suppress:"N"});
it("preserves explicit product form and single-ingredient strength without parsing the name",()=>{
 const row=normalizeRxNorm("198440",{properties:c("198440","source product","SCD")},{relatedGroup:{conceptGroup:[{tty:"IN",conceptProperties:[c("161","acetaminophen","IN")]}]}},{propConceptGroup:{propConcept:[{propCategory:"ATTRIBUTES",propName:"AVAILABLE_STRENGTH",propValue:"500 MG"}]}},{relatedGroup:{conceptGroup:[{tty:"DF",conceptProperties:[c("317541","Oral Tablet","DF")]}]}});
 expect(row.facts.dosageForm).toBe("Oral Tablet");expect(row.ingredients[0].strength).toBe("500 MG");expect(row.registrations).toEqual([]);expect(row.labels).toEqual([]);
});
it("keeps unknown strength unknown rather than extracting it from a name",()=>{
 const row=normalizeRxNorm("198440",{properties:c("198440","acetaminophen 500 MG Oral Tablet","SCD")},{relatedGroup:{conceptGroup:[{tty:"IN",conceptProperties:[c("161","acetaminophen","IN")]}]}});
 expect(row.ingredients[0].strength).toBeNull();expect(row.facts.dosageForm).toBeNull();
});
it("rejects malformed source attribute data",()=>{expect(()=>normalizeRxNorm("198440",{properties:c("198440","source product","SCD")},{},{propConceptGroup:{propConcept:[{propName:"AVAILABLE_STRENGTH",propValue:500}]}})).toThrow();});
