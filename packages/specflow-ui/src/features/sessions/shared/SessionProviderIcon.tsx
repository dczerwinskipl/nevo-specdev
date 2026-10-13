import { Icon } from '@nevo/ui';
import codex from './provider-icons/codex.svg?url';
import claude from './provider-icons/claude-color.svg?url';

const providerIcons: Readonly<Record<string, string>> = { codex, claude };

/** Provider identity is supplied by the association, never inferred from its title or role. */
export function SessionProviderIcon({ providerId }: { readonly providerId?: string }) {
  const asset = providerId ? providerIcons[providerId] : undefined;
  if (!asset) return <Icon name="chat" size="sm" />;
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-4 shrink-0 bg-current"
      style={{
        maskImage: `url("${asset}")`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  );
}
