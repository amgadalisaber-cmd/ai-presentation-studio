import { StyleForm } from "@/components/styles/StyleForm";
import { DEFAULT_SPEC } from "@/lib/styles/spec";
export default function NewStylePage() {
  return <div className="space-y-6"><h1 className="h1">New concept</h1><StyleForm initial={{ name: "", description: "", tone: "", voice: "", spec: DEFAULT_SPEC, composition: "", layoutRules: "", typography: "", imageTreatment: "", backgroundTreatment: "", colorBehavior: "", lighting: "", density: "", decorative: "", negative: "" }} /></div>;
}
