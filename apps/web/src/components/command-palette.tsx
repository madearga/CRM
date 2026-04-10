"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/convex/hooks";
import { api } from "@convex/_generated/api";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Building2,
  Users,
  Handshake,
  LayoutDashboard,
  Settings,
  Activity,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Deals", href: "/deals", icon: Handshake },
  { label: "Activities", href: "/activities", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const { data: searchResults } = useAuthQuery(
    api.search.globalSearch,
    query.length >= 2 ? { query } : "skip",
  );

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset query on close
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false);
      command();
    },
    [],
  );

  const hasResults =
    searchResults &&
    (searchResults.companies.length > 0 ||
      searchResults.contacts.length > 0 ||
      searchResults.deals.length > 0);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search companies, contacts, deals..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Search results */}
        {searchResults && searchResults.companies.length > 0 && (
          <CommandGroup heading="Companies">
            {searchResults.companies.map((company) => (
              <CommandItem
                key={company.id}
                value={`company-${company.name}`}
                onSelect={() => runCommand(() => router.push(`/companies/${company.id}`))}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <span>{company.name}</span>
                {company.industry && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {company.industry}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {searchResults && searchResults.contacts.length > 0 && (
          <CommandGroup heading="Contacts">
            {searchResults.contacts.map((contact) => (
              <CommandItem
                key={contact.id}
                value={`contact-${contact.fullName}`}
                onSelect={() => runCommand(() => router.push(`/contacts/${contact.id}`))}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>{contact.fullName}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {contact.email}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {searchResults && searchResults.deals.length > 0 && (
          <CommandGroup heading="Deals">
            {searchResults.deals.map((deal) => (
              <CommandItem
                key={deal.id}
                value={`deal-${deal.title}`}
                onSelect={() => runCommand(() => router.push(`/deals/${deal.id}`))}
              >
                <Handshake className="mr-2 h-4 w-4" />
                <span>{deal.title}</span>
                <span className="ml-2 text-xs text-muted-foreground capitalize">
                  {deal.stage}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Navigation (show when not searching or no results) */}
        {(!hasResults || query.length < 2) && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Navigation">
              {NAV_ITEMS.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`nav-${item.label}`}
                  onSelect={() => runCommand(() => router.push(item.href))}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
