import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Typography,
} from '@nevo/ui';
import { useTranslation } from 'react-i18next';

export interface NewConversationModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onStart?: (agent: string) => void;
}

export function NewConversationModal({ open, onClose, onStart }: NewConversationModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('specification.conversationModalTitle')}</DialogTitle>
        </DialogHeader>

        <DialogBody className="py-4">
          <Typography variant="body-sm" className="text-content-muted">
            {t('common.notImplemented')}
          </Typography>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          {onStart ? (
            <Button variant="primary" onClick={() => onStart('default')}>
              {t('specification.newConversation')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
