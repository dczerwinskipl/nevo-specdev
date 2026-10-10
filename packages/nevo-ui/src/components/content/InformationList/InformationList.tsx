import { forwardRef, type HTMLAttributes } from 'react';
import { useDesignMetadata } from '@nevo/figma-capture/metadata';
import { cn } from '../../../lib';
import { InformationListContent } from './InformationListContent';
import { InformationListItem } from './InformationListItem';
import { InformationListLeading } from './InformationListLeading';
import { InformationListTrailing } from './InformationListTrailing';
import { InformationListContext } from './informationListContext';
import { informationListDefaults } from './informationListContract';

export interface InformationListProps extends HTMLAttributes<HTMLUListElement> {
  readonly selectable?: boolean;
}

const InformationListRoot = forwardRef<HTMLUListElement, InformationListProps>(
  function InformationList(
    { children, className, selectable = informationListDefaults.selectable, ...props },
    ref,
  ) {
    const capture = useDesignMetadata('InformationList', { selectable });

    return (
      <InformationListContext.Provider value={{ selectable }}>
        <ul
          ref={ref}
          className={cn('m-0 min-w-0 list-none divide-y divide-border-subtle p-0', className)}
          {...props}
          {...capture}
        >
          {children}
        </ul>
      </InformationListContext.Provider>
    );
  },
);

export const InformationList = Object.assign(InformationListRoot, {
  Item: InformationListItem,
  Leading: InformationListLeading,
  Content: InformationListContent,
  Trailing: InformationListTrailing,
});
