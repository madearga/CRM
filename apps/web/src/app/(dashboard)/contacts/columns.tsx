"use client";

import { memo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Phone } from "lucide-react";
import Link from "next/link";
import { LIFECYCLE_COLORS } from "@/lib/constants";
import { DataTableColumnHeader } from "@/components/data-table";

export type ContactRow = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  image?: string | null;
  lifecycleStage?: string | null;
  lastTouchedDays?: number | null;
  lastTouchStatus?: string | null;
};

const ContactCell = memo(({ id, fullName, jobTitle, image }: ContactRow & { id: string }) => (
  <div className="flex items-center gap-3">
    <Avatar className="size-9">
      <AvatarImage src={image ?? undefined} />
      <AvatarFallback className="text-xs">
        {fullName?.split(" ").map((n) => n[0]).join("").toUpperCase() ?? "?"}
      </AvatarFallback>
    </Avatar>
    <div>
      <Link href={`/contacts/${id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
        {fullName}
      </Link>
      {jobTitle && <p className="text-xs text-muted-foreground">{jobTitle}</p>}
    </div>
  </div>
));
ContactCell.displayName = "ContactCell";

const EmailCell = memo(({ email }: { email: string }) => (
  <div className="flex items-center gap-1 text-muted-foreground">
    <Mail className="h-3 w-3" />
    {email}
  </div>
));
EmailCell.displayName = "EmailCell";

const PhoneCell = memo(({ phone }: { phone?: string | null }) => (
  phone ? (
    <div className="flex items-center gap-1 text-muted-foreground">
      <Phone className="h-3 w-3" />
      {phone}
    </div>
  ) : (
    <span className="text-muted-foreground">—</span>
  )
));
PhoneCell.displayName = "PhoneCell";

const StageCell = memo(({ stage }: { stage?: string | null }) => (
  stage ? (
    <Badge variant="secondary" className={LIFECYCLE_COLORS[stage] ?? ""}>
      {stage}
    </Badge>
  ) : (
    <span className="text-muted-foreground">—</span>
  )
));
StageCell.displayName = "StageCell";

const LastTouchCell = memo(({ days, status }: { days?: number | null; status?: string | null }) => (
  days !== null && days !== undefined ? (
    <Badge variant={status === "green" ? "secondary" : "destructive"} className="text-xs">
      {days}d ago
    </Badge>
  ) : (
    <span className="text-xs text-muted-foreground">never</span>
  )
));
LastTouchCell.displayName = "LastTouchCell";

export function getColumns({
  selectedIds,
  toggleOne,
}: {
  selectedIds: Set<string>;
  toggleOne: (id: string) => void;
}): ColumnDef<ContactRow>[] {
  return [
    {
      id: "select",
      size: 40,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={() => toggleOne(row.original.id)}
          aria-label={`Select ${row.original.fullName}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "contact",
      accessorKey: "fullName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
      size: 260,
      cell: ({ row }) => <ContactCell {...row.original} />,
    },
    {
      id: "email",
      accessorKey: "email",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      size: 200,
      cell: ({ row }) => <EmailCell email={row.original.email} />,
    },
    {
      id: "phone",
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      size: 150,
      cell: ({ row }) => <PhoneCell phone={row.original.phone} />,
    },
    {
      id: "stage",
      accessorKey: "lifecycleStage",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Stage" />,
      size: 120,
      cell: ({ row }) => <StageCell stage={row.original.lifecycleStage} />,
    },
    {
      id: "lastTouch",
      accessorKey: "lastTouchedDays",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Touch" />,
      size: 120,
      cell: ({ row }) => <LastTouchCell days={row.original.lastTouchedDays} status={row.original.lastTouchStatus} />,
    },
    {
      id: "actions",
      header: "",
      size: 80,
      enableSorting: false,
      cell: () => null,
    },
  ];
}
