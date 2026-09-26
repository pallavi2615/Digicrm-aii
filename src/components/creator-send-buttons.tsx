import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Linkedin, Copy } from "lucide-react";
import { toast } from "sonner";

/** Splits an AI email draft into subject + body when it starts with "Subject: …". */
export function splitSubject(text: string, fallback = "Collaboration idea") {
  const m = text.match(/^\s*\**subject\**\s*:\s*(.+)\n+/i);
  return m ? { subject: m[1].replace(/\*/g, "").trim(), body: text.slice(m[0].length).trim() } : { subject: fallback, body: text.trim() };
}

/**
 * Opens the creator's own email app, WhatsApp or LinkedIn with the draft filled
 * in. The creator presses Send there, so messages leave from their own accounts.
 */
export function CreatorSendButtons({ text, email, phone, linkedin, subject, onSent }: {
  text: string; email?: string | null; phone?: string | null; linkedin?: string | null; subject?: string;
  onSent?: (channel: string) => void;
}) {
  const disabled = !text.trim();
  const open = (url: string, channel: string) => { window.open(url, "_blank", "noopener"); onSent?.(channel); };
  const sendEmail = () => {
    const s = splitSubject(text, subject);
    open(`mailto:${encodeURIComponent(email ?? "")}?subject=${encodeURIComponent(s.subject)}&body=${encodeURIComponent(s.body)}`, "Email");
  };
  const sendWa = () => {
    const num = (phone ?? "").replace(/[^\d]/g, "");
    open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "WhatsApp");
  };
  const sendLi = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    toast.success("Message copied — paste it into LinkedIn");
    const url = linkedin && /^https?:\/\//.test(linkedin) ? linkedin : "https://www.linkedin.com/messaging/";
    open(url, "LinkedIn");
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={disabled} onClick={sendEmail}><Mail className="h-4 w-4 mr-1" />Send email</Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={sendWa}><MessageCircle className="h-4 w-4 mr-1" />WhatsApp</Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={sendLi}><Linkedin className="h-4 w-4 mr-1" />LinkedIn</Button>
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => { navigator.clipboard.writeText(text); toast.success("Copied"); }}><Copy className="h-4 w-4 mr-1" />Copy</Button>
      {!email && <p className="w-full text-xs text-muted-foreground">Tip: add an email, phone or LinkedIn to the brand contact to fill in the recipient automatically.</p>}
    </div>
  );
}
