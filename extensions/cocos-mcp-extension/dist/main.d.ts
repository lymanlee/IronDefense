export declare function load(): void;
export declare function unload(): void;
export declare const methods: {
    startServer(): Promise<{
        running: boolean;
        host: string;
        port: number;
    }>;
    stopServer(): Promise<{
        running: boolean;
        host: string;
        port: number;
    }>;
    getServerStatus(): Promise<{
        transport: {
            running: boolean;
            host: string;
            port: number;
        };
        entitlement: import("../../shared/dist").EntitlementSnapshot;
        scene: {
            revision: number;
            dirty: boolean;
        };
        tools: string[];
        toolDetails: {
            name: string;
            title: string;
            description: string;
        }[];
    }>;
    openStatusPanel(): Promise<boolean>;
};
