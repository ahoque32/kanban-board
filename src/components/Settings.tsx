"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  onSaved?: () => void;
};

export function Settings({ onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [webhook, setWebhook] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    fetch("/api/webhook")
      .then((response) => response.json())
      .then((data) => setWebhook(data.discordWebhookUrl || ""))
      .catch(() => setWebhook(""));
  }, [open]);

  async function handleSave() {
    setSaving(true);
    const response = await fetch("/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordWebhookUrl: webhook }),
    });
    setSaving(false);

    if (!response.ok) {
      alert("Failed to save webhook");
      return;
    }

    onSaved?.();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">Settings</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Integrations</DialogTitle>
          <DialogDescription>
            Configure Discord webhook notifications for task creation, moves, and completion.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="https://discord.com/api/webhooks/..."
          value={webhook}
          onChange={(event) => setWebhook(event.target.value)}
        />

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
