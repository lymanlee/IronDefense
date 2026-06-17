import { type EntitlementSnapshot, type FeatureKey } from "@cocos-mcp/shared";
export interface EntitlementGate {
    getSnapshot(): Promise<EntitlementSnapshot>;
    assertFeature(feature: FeatureKey): Promise<void>;
    hasFeature(feature: FeatureKey): Promise<boolean>;
}
export declare class DevelopmentEntitlementGate implements EntitlementGate {
    private readonly snapshot;
    constructor();
    getSnapshot(): Promise<EntitlementSnapshot>;
    assertFeature(feature: FeatureKey): Promise<void>;
    hasFeature(feature: FeatureKey): Promise<boolean>;
}
