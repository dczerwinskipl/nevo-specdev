/** Generic UI composition identity. Feature-specific contracts belong to their hosts. */
export interface UiContribution {
  readonly id: string;
}

declare const contributionType: unique symbol;

// Private nominal marker: public UiModule values must use contributeTo() to
// create a registration with the extension point's required contribution type.
const registrationBrand: unique symbol = Symbol('UiContributionRegistration');

/** A typed token; the optional phantom member exists only for TypeScript inference. */
export interface UiExtensionPoint<T extends UiContribution> {
  readonly id: string;
  readonly [contributionType]?: () => T;
}

export interface UiContributionRegistration {
  readonly [registrationBrand]: true;
  readonly point: UiExtensionPoint<UiContribution>;
  readonly contribution: UiContribution;
}

export interface UiModule {
  readonly id: string;
  readonly contributions: readonly UiContributionRegistration[];
}

/** Both registration and lookup retain the contribution contract defined by the host. */
export function defineUiExtensionPoint<T extends UiContribution>(id: string): UiExtensionPoint<T> {
  return Object.freeze({ id });
}

export function contributeTo<T extends UiContribution>(
  point: UiExtensionPoint<T>,
  contribution: NoInfer<T>,
): UiContributionRegistration {
  return { point, contribution, [registrationBrand]: true };
}
