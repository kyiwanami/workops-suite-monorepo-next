'use client';

import { Button } from '@workops/ui/components/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@workops/ui/components/command';
import { Field, FieldDescription, FieldLabel } from '@workops/ui/components/field';
import { Popover, PopoverContent, PopoverTrigger } from '@workops/ui/components/popover';
import { cn } from '@workops/ui/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import type { Member } from '../data';

// 担当者の選択です。部署の有効な利用者を名前・メールで検索して選びます。先頭の「未割当」で担当者を外せます。
// 名前が未設定の利用者は名前の欄にメールが入るため、メールの行を重ねて出しません。
export function AssigneeField({
  members,
  value,
  onChange,
}: {
  members: Member[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = members.find((member) => member.sub === value);
  // 選んだ値を渡してメニューを閉じます。
  const select = (sub: string | null) => {
    onChange(sub);
    setOpen(false);
  };
  return (
    <Field>
      <FieldLabel htmlFor="assigneeSub">担当者</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id="assigneeSub" type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
            {selected === undefined ? '未割当' : selected.name}
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder="名前・メールで検索" />
            <CommandList>
              <CommandEmpty>該当する利用者はいません</CommandEmpty>
              <CommandGroup>
                <CommandItem value="未割当" onSelect={() => select(null)}>
                  <Check className={cn(value === null ? 'opacity-100' : 'opacity-0')} />
                  未割当
                </CommandItem>
                {members.map((member) => (
                  <CommandItem key={member.sub} value={`${member.name} ${member.email}`} onSelect={() => select(member.sub)}>
                    <Check className={cn(value === member.sub ? 'opacity-100' : 'opacity-0')} />
                    <span className="grid">
                      <span>{member.name}</span>
                      {member.name !== member.email && (
                        <span className="text-xs text-muted-foreground">{member.email}</span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FieldDescription>部署の有効な利用者から検索して選びます。</FieldDescription>
    </Field>
  );
}
