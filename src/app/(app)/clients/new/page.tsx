import { ClientForm, emptyClient } from "@/components/clients/ClientForm";
export default function NewClientPage() { return <div className="max-w-4xl space-y-6"><h1 className="h1">New client / brand profile</h1><ClientForm initial={emptyClient} /></div>; }
