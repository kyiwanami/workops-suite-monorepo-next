'use client';

import { Badge } from '@workops/ui/components/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@workops/ui/components/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import type { AssetRow } from '../data';
import { statusBadges } from '../labels';
import { assetStatus } from '../schema';

// 資産の状態のバッジです。変更できる人には、矢印付きのバッジを押して状態を選ぶメニューにします。選んだ状態を onChange に渡します。
export function StatusMenu({
  status,
  editable,
  disabled,
  onChange,
}: {
  status: AssetRow['status'];
  editable: boolean;
  disabled: boolean;
  onChange: (status: AssetRow['status']) => void;
}) {
  const badge = statusBadges[status];
  if (!editable) {
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled} className="rounded-full disabled:opacity-60">
        <Badge variant={badge.variant} className="cursor-pointer gap-1 pr-2">
          {badge.label}
          <ChevronDown />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(value) => {
            const next = assetStatus.parse(value);
            if (next !== status) {
              onChange(next);
            }
          }}
        >
          {assetStatus.options.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {statusBadges[value].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
