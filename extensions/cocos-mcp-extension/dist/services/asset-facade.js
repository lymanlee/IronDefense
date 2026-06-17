"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CocosAssetFacade = void 0;
const shared_1 = require("@cocos-mcp/shared");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
class CocosAssetFacade {
    async findAssets(request) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        const pattern = request.pattern?.trim();
        const importer = request.importer?.trim();
        const assetType = request.assetType?.trim();
        const exact = request.exact ?? false;
        const maxResults = Math.max(1, Math.floor(request.maxResults ?? 20));
        const query = {
            pattern: "db://assets/**",
        };
        if (assetType) {
            query.ccType = assetType;
        }
        try {
            const raw = await Editor.Message.request("asset-db", "query-assets", query);
            const entries = Array.isArray(raw) ? raw : [];
            const filtered = entries
                .map((entry) => this.toAssetSummary(entry))
                .filter((entry) => Boolean(entry))
                .filter((entry) => entry.url.startsWith("db://assets/"))
                .filter((entry) => this.matchesAssetQuery(entry, {
                pattern,
                importer,
                assetType,
                exact,
            }))
                .slice(0, maxResults);
            return {
                matches: filtered,
            };
        }
        catch (error) {
            throw this.normalizeAssetError(error);
        }
    }
    async openAsset(request) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        const asset = await this.resolveAsset(request);
        try {
            await Editor.Message.request("asset-db", "open-asset", asset.uuid);
            return {
                uuid: asset.uuid,
                url: asset.url,
                opened: true,
            };
        }
        catch (error) {
            throw this.normalizeAssetError(error);
        }
    }
    async resolveAsset(request) {
        const url = request.url?.trim();
        const uuid = request.uuid?.trim();
        if (!url && !uuid) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "url or uuid is required");
        }
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        try {
            const raw = await Editor.Message.request("asset-db", "query-asset-info", url || uuid);
            const summary = this.toAssetSummary(raw);
            if (!summary) {
                throw new shared_1.AppError("INVALID_ARGUMENT", "Asset was not found");
            }
            return summary;
        }
        catch (error) {
            if (error instanceof shared_1.AppError) {
                throw error;
            }
            throw new shared_1.AppError("INVALID_ARGUMENT", "Asset was not found", {
                reason: "The requested asset could not be resolved.",
                context: {
                    url,
                    uuid,
                },
                suggestion: "Use asset_find first or provide a valid asset url or uuid.",
            });
        }
    }
    async resolveSpriteFrameAsset(request) {
        const asset = await this.resolveAsset(request);
        if (this.isSpriteFrameAsset(asset)) {
            return asset;
        }
        if (this.isImageAssetUrl(asset.url)) {
            await this.ensureSpriteFrameImageImport(asset.url, asset.uuid);
            return this.resolveSpriteFrameSubAsset(asset.url);
        }
        throw new shared_1.AppError("INVALID_ARGUMENT", "Expected a SpriteFrame or image asset", {
            reason: `Resolved asset "${asset.url}" is not a SpriteFrame or supported image asset.`,
            context: {
                uuid: asset.uuid,
                url: asset.url,
                importer: asset.importer,
                type: asset.type,
            },
            suggestion: "Use a SpriteFrame sub-asset url such as db://.../spriteFrame, or pass a PNG/JPG/WebP asset that can be reimported as sprite-frame.",
        });
    }
    async findScripts(request) {
        const result = await this.findAssets({
            importer: "typescript",
            maxResults: Math.max(1, Math.floor(request.maxResults ?? 20)) * 3,
        });
        const pattern = request.pattern?.trim().toLowerCase();
        const exact = request.exact ?? false;
        const matches = result.matches
            .map((asset) => this.toScriptSummary(asset))
            .filter((entry) => Boolean(entry))
            .filter((entry) => {
            if (!pattern) {
                return true;
            }
            const candidates = [
                entry.name,
                entry.url,
                entry.path,
                entry.className,
            ]
                .filter((value) => typeof value === "string")
                .map((value) => value.toLowerCase());
            return candidates.some((candidate) => exact ? candidate === pattern : candidate.includes(pattern));
        })
            .slice(0, Math.max(1, Math.floor(request.maxResults ?? 20)));
        return {
            matches,
        };
    }
    async resolveScript(request) {
        const asset = await this.resolveAsset(request);
        const summary = this.toScriptSummary(asset);
        if (!summary) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "Resolved asset is not a TypeScript script asset", {
                reason: `Resolved asset "${asset.url}" is not a supported script asset.`,
                context: {
                    uuid: asset.uuid,
                    url: asset.url,
                    importer: asset.importer,
                    type: asset.type,
                },
                suggestion: "Use script_find first or provide a valid TypeScript script asset url or uuid.",
            });
        }
        return summary;
    }
    async createScript(request) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        const normalizedUrl = this.normalizeScriptTargetUrl({
            scriptUrl: request.scriptUrl,
            scriptPath: request.scriptPath,
        });
        const className = this.resolveRequestedClassName(request.className, this.deriveAssetName(normalizedUrl));
        const content = this.buildComponentScriptTemplate(className);
        try {
            await Editor.Message.request("asset-db", "create-asset", normalizedUrl, content, {
                overwrite: request.overwrite ?? false,
                rename: !(request.overwrite ?? false),
            });
            await Editor.Message.request("asset-db", "refresh-asset", normalizedUrl);
            const script = await this.resolveScript({ url: normalizedUrl });
            if (script.className !== className) {
                throw new shared_1.AppError("INVALID_ARGUMENT", `Created script class "${script.className}" does not match requested class "${className}"`, {
                    reason: "The generated script file was created, but the resolved attach-ready class name did not match the expected class.",
                    context: {
                        requestedClassName: className,
                        resolvedClassName: script.className,
                        scriptUrl: normalizedUrl,
                    },
                    suggestion: "Use a file name and class name that match, then retry script_create.",
                });
            }
            const openAfterCreate = request.openAfterCreate ?? false;
            if (openAfterCreate) {
                await this.openAsset({ url: script.url });
            }
            return {
                script,
                created: true,
                overwritten: request.overwrite ?? false,
                opened: openAfterCreate,
            };
        }
        catch (error) {
            if (error instanceof shared_1.AppError) {
                throw error;
            }
            throw new shared_1.AppError("INVALID_ARGUMENT", "Failed to create script asset", {
                reason: "The requested script asset could not be created.",
                context: {
                    scriptUrl: normalizedUrl,
                    className,
                    overwrite: request.overwrite ?? false,
                },
                suggestion: "Check whether the target script path is valid and whether overwrite should be enabled.",
            });
        }
    }
    async refreshScript(request) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        const script = await this.resolveScript(request);
        try {
            await Editor.Message.request("asset-db", "reimport-asset", script.url);
            await Editor.Message.request("asset-db", "refresh-asset", script.url);
            return await this.resolveScript({ url: script.url });
        }
        catch (error) {
            if (error instanceof shared_1.AppError) {
                throw error;
            }
            throw new shared_1.AppError("INVALID_ARGUMENT", "Failed to refresh script asset", {
                reason: "The script asset could not be reimported through the editor asset database.",
                context: {
                    scriptUrl: script.url,
                    scriptUuid: script.uuid,
                    error: error instanceof Error ? error.message : String(error),
                },
                suggestion: "Check that the script compiles in Cocos Creator, then retry script_refresh.",
            });
        }
    }
    async importAsset(request) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        const sourcePath = request.sourcePath?.trim();
        if (!sourcePath) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "sourcePath is required");
        }
        const targetUrl = this.normalizeImportTargetUrl({
            sourcePath,
            targetUrl: request.targetUrl,
            targetFolder: request.targetFolder,
        });
        try {
            await Editor.Message.request("asset-db", "import-asset", sourcePath, targetUrl, {
                overwrite: request.overwrite ?? false,
                rename: !(request.overwrite ?? false),
            });
            await Editor.Message.request("asset-db", "refresh-asset", targetUrl);
            const asset = await this.resolveAsset({ url: targetUrl });
            const spriteFrameAsset = await this.tryResolveImportedSpriteFrame(targetUrl, asset);
            return {
                asset,
                fileAsset: asset,
                spriteFrameAsset,
                sourcePath,
                targetUrl,
                imported: true,
                overwritten: request.overwrite ?? false,
            };
        }
        catch (error) {
            if (error instanceof shared_1.AppError) {
                throw error;
            }
            throw new shared_1.AppError("INVALID_ARGUMENT", "Failed to import asset", {
                reason: "The source file could not be imported into the project assets.",
                context: {
                    sourcePath,
                    targetUrl,
                    overwrite: request.overwrite ?? false,
                },
                suggestion: "Check that the sourcePath exists and the target asset url points inside db://assets/.",
            });
        }
    }
    async deleteAsset(request) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        const asset = await this.resolveAsset(request);
        try {
            await Editor.Message.request("asset-db", "delete-asset", asset.url);
            await Editor.Message.request("asset-db", "refresh-asset", "db://assets");
            return {
                url: asset.url,
                deleted: true,
            };
        }
        catch (error) {
            if (error instanceof shared_1.AppError) {
                throw error;
            }
            throw new shared_1.AppError("INVALID_ARGUMENT", "Failed to delete asset", {
                reason: "The requested asset could not be deleted from the project.",
                context: {
                    url: asset.url,
                    uuid: asset.uuid,
                },
                suggestion: "Check that the asset exists in db://assets/ and is not locked by the editor.",
            });
        }
    }
    async createPlaceholderAsset(request) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        if (request.kind !== "sprite-frame") {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Unsupported placeholder kind "${request.kind}"`);
        }
        const targetUrl = this.normalizePlaceholderTargetUrl({
            targetUrl: request.targetUrl,
            targetFolder: request.targetFolder,
            name: request.name,
        });
        const width = this.normalizePlaceholderDimension(request.width, "width");
        const height = this.normalizePlaceholderDimension(request.height, "height");
        const color = this.normalizePlaceholderColor(request.color);
        const localPath = this.assetUrlToFilePath(targetUrl);
        const metaPath = `${localPath}.meta`;
        const png = this.buildSolidPng(width, height, color);
        try {
            const parentDir = path.dirname(localPath);
            fs.mkdirSync(parentDir, { recursive: true });
            if (!request.overwrite && fs.existsSync(localPath)) {
                throw new shared_1.AppError("INVALID_ARGUMENT", `Asset "${targetUrl}" already exists`, {
                    reason: "The requested placeholder asset path already exists and overwrite is disabled.",
                    context: {
                        targetUrl,
                        overwrite: false,
                    },
                    suggestion: "Enable overwrite or choose a different targetUrl/targetFolder + name.",
                });
            }
            fs.writeFileSync(localPath, png);
            fs.writeFileSync(metaPath, JSON.stringify(this.buildPlaceholderImageMeta(metaPath), null, 2));
            await Editor.Message.request("asset-db", "refresh-asset", targetUrl);
            const fileAsset = await this.resolveAsset({ url: targetUrl });
            await this.ensureSpriteFrameImageImport(targetUrl, fileAsset.uuid);
            const spriteFrameAsset = await this.resolveSpriteFrameSubAsset(targetUrl);
            const openAfterCreate = request.openAfterCreate ?? false;
            if (openAfterCreate) {
                await this.openAsset({ url: spriteFrameAsset.url });
            }
            return {
                kind: "sprite-frame",
                asset: spriteFrameAsset,
                fileAsset,
                targetUrl,
                created: true,
                overwritten: request.overwrite ?? false,
                opened: openAfterCreate,
                width,
                height,
                color,
            };
        }
        catch (error) {
            if (error instanceof shared_1.AppError) {
                throw error;
            }
            throw new shared_1.AppError("INVALID_ARGUMENT", "Failed to create placeholder asset", {
                reason: "The placeholder texture file could not be created or resolved in the asset database.",
                context: {
                    targetUrl,
                    width,
                    height,
                    color,
                    overwrite: request.overwrite ?? false,
                },
                suggestion: "Check that the target asset path is valid and that the editor can refresh project assets.",
            });
        }
    }
    async createPrefab(request) {
        if (!Editor?.Message?.request) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Message.request is unavailable");
        }
        const prefabUrl = this.normalizePrefabTargetUrl({
            prefabUrl: request.prefabUrl,
            prefabPath: request.prefabPath,
            prefabName: request.prefabName,
        });
        const prefabContent = JSON.stringify(request.prefabJson, null, 2);
        try {
            await Editor.Message.request("asset-db", "create-asset", prefabUrl, prefabContent, {
                overwrite: request.overwrite ?? false,
                rename: !(request.overwrite ?? false),
            });
            await Editor.Message.request("asset-db", "refresh-asset", prefabUrl);
            const prefab = await this.resolveAsset({ url: prefabUrl });
            const openAfterCreate = request.openAfterCreate ?? false;
            if (openAfterCreate) {
                await this.openAsset({ url: prefab.url });
            }
            return {
                prefab,
                sourceNode: request.sourceNode,
                created: true,
                overwritten: request.overwrite ?? false,
                opened: openAfterCreate,
            };
        }
        catch (error) {
            if (error instanceof shared_1.AppError) {
                throw error;
            }
            throw new shared_1.AppError("INVALID_ARGUMENT", "Failed to create prefab asset", {
                reason: "The prefab asset could not be created from the generated prefab data.",
                context: {
                    prefabUrl,
                    sourceNode: request.sourceNode,
                    overwrite: request.overwrite ?? false,
                },
                suggestion: "Check that the prefab path is valid and the source node can be serialized as a prefab.",
            });
        }
    }
    matchesAssetQuery(asset, query) {
        if (query.importer) {
            const importer = asset.importer?.toLowerCase() ?? "";
            if (importer !== query.importer.toLowerCase()) {
                return false;
            }
        }
        if (query.assetType) {
            const type = asset.type?.toLowerCase() ?? "";
            if (type !== query.assetType.toLowerCase()) {
                return false;
            }
        }
        if (!query.pattern) {
            return true;
        }
        const pattern = query.pattern.toLowerCase();
        const candidates = [asset.name, asset.url, asset.path]
            .filter((value) => typeof value === "string")
            .map((value) => value.toLowerCase());
        return candidates.some((candidate) => query.exact ? candidate === pattern : candidate.includes(pattern));
    }
    toAssetSummary(value) {
        if (!value || typeof value !== "object") {
            return null;
        }
        const record = value;
        const uuid = typeof record.uuid === "string" ? record.uuid.trim() : "";
        const url = typeof record.url === "string" ? record.url.trim() : "";
        if (!uuid || !url) {
            return null;
        }
        const name = typeof record.name === "string" && record.name.trim()
            ? record.name.trim()
            : this.deriveAssetName(url);
        return {
            uuid,
            name,
            url,
            path: typeof record.file === "string"
                ? record.file
                : typeof record.path === "string"
                    ? record.path
                    : undefined,
            importer: typeof record.importer === "string" ? record.importer : undefined,
            type: typeof record.type === "string"
                ? record.type
                : typeof record.ctor === "string"
                    ? record.ctor
                    : undefined,
        };
    }
    deriveAssetName(url) {
        const normalized = url.replace(/^db:\/\/assets\//, "");
        const parts = normalized.split("/");
        return parts.at(-1) ?? normalized;
    }
    toScriptSummary(asset) {
        if (asset.importer?.toLowerCase() !== "typescript") {
            return null;
        }
        const className = this.deriveScriptClassName(asset.name);
        if (!className) {
            return null;
        }
        return {
            uuid: asset.uuid,
            name: asset.name,
            url: asset.url,
            path: asset.path,
            className,
        };
    }
    deriveScriptClassName(name) {
        return name.replace(/\.(ts|js)$/i, "").trim();
    }
    normalizeScriptTargetUrl(request) {
        const url = request.scriptUrl?.trim();
        const scriptPath = request.scriptPath?.trim();
        const normalized = url
            ? url
            : scriptPath
                ? `db://assets/${scriptPath.replace(/^\/+/, "")}`
                : "";
        if (!normalized) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "scriptUrl or scriptPath is required");
        }
        if (!normalized.startsWith("db://assets/")) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "Scripts must be created under db://assets/");
        }
        if (!normalized.toLowerCase().endsWith(".ts")) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "Scripts must use a .ts extension");
        }
        return normalized;
    }
    resolveRequestedClassName(requested, fileName) {
        const raw = requested?.trim() || this.deriveScriptClassName(fileName);
        if (!raw) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "Unable to derive script className");
        }
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "className must be a valid TypeScript identifier");
        }
        return raw;
    }
    buildComponentScriptTemplate(className) {
        return `import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

@ccclass('${className}')
export class ${className} extends Component {
  start() {}

  update(_deltaTime: number) {}
}
`;
    }
    normalizeImportTargetUrl(request) {
        const explicitTargetUrl = request.targetUrl?.trim();
        if (explicitTargetUrl) {
            this.assertProjectAssetUrl(explicitTargetUrl);
            return explicitTargetUrl;
        }
        const targetFolder = request.targetFolder?.trim();
        const fileName = request.sourcePath.split(/[\\/]/).filter(Boolean).at(-1);
        if (!fileName) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "Unable to derive file name from sourcePath");
        }
        const folderUrl = targetFolder
            ? targetFolder.startsWith("db://")
                ? targetFolder
                : `db://assets/${targetFolder.replace(/^\/+/, "")}`
            : "db://assets";
        this.assertProjectAssetUrl(folderUrl);
        return `${folderUrl.replace(/\/+$/, "")}/${fileName}`;
    }
    assertProjectAssetUrl(url) {
        if (!url.startsWith("db://assets/") && url !== "db://assets") {
            throw new shared_1.AppError("INVALID_ARGUMENT", "Target asset url must be under db://assets/");
        }
    }
    normalizePrefabTargetUrl(request) {
        const prefabUrl = request.prefabUrl?.trim();
        if (prefabUrl) {
            this.assertProjectAssetUrl(prefabUrl);
            if (!prefabUrl.toLowerCase().endsWith(".prefab")) {
                throw new shared_1.AppError("INVALID_ARGUMENT", "Prefab assets must use a .prefab extension");
            }
            return prefabUrl;
        }
        const prefabPath = request.prefabPath?.trim();
        const prefabName = request.prefabName?.trim();
        const normalizedName = prefabName
            ? prefabName.endsWith(".prefab")
                ? prefabName
                : `${prefabName}.prefab`
            : "";
        if (prefabPath) {
            const base = prefabPath.startsWith("db://")
                ? prefabPath
                : `db://assets/${prefabPath.replace(/^\/+/, "")}`;
            this.assertProjectAssetUrl(base);
            return base.toLowerCase().endsWith(".prefab")
                ? base
                : `${base.replace(/\/+$/, "")}/${normalizedName || "NewPrefab.prefab"}`;
        }
        if (!normalizedName) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "prefabUrl or prefabPath/prefabName is required");
        }
        return `db://assets/${normalizedName}`;
    }
    normalizePlaceholderTargetUrl(request) {
        const explicitTargetUrl = request.targetUrl?.trim();
        if (explicitTargetUrl) {
            this.assertProjectAssetUrl(explicitTargetUrl);
            if (!explicitTargetUrl.toLowerCase().endsWith(".png")) {
                throw new shared_1.AppError("INVALID_ARGUMENT", "Placeholder sprite-frame assets must use a .png targetUrl");
            }
            return explicitTargetUrl;
        }
        const targetFolder = request.targetFolder?.trim();
        const rawName = request.name?.trim() || "Placeholder";
        const normalizedName = rawName.toLowerCase().endsWith(".png")
            ? rawName
            : `${rawName}.png`;
        const folderUrl = targetFolder
            ? targetFolder.startsWith("db://")
                ? targetFolder
                : `db://assets/${targetFolder.replace(/^\/+/, "")}`
            : "db://assets";
        this.assertProjectAssetUrl(folderUrl);
        return `${folderUrl.replace(/\/+$/, "")}/${normalizedName}`;
    }
    normalizePlaceholderDimension(value, label) {
        if (value === undefined) {
            return 64;
        }
        if (!Number.isInteger(value) || value <= 0 || value > 2048) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `${label} must be an integer between 1 and 2048`);
        }
        return value;
    }
    normalizePlaceholderColor(value) {
        const normalized = (value?.trim() || "#ffffff").toLowerCase();
        if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/.test(normalized)) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "color must be #RRGGBB or #RRGGBBAA");
        }
        return normalized;
    }
    assetUrlToFilePath(url) {
        const projectPath = String(Editor?.Project?.path ?? "").trim();
        if (!projectPath) {
            throw new shared_1.AppError("EDITOR_NOT_READY", "Editor.Project.path is unavailable");
        }
        if (!url.startsWith("db://assets/")) {
            throw new shared_1.AppError("INVALID_ARGUMENT", "Target asset url must be under db://assets/");
        }
        const relativePath = url.replace(/^db:\/\/assets\//, "");
        return path.join(projectPath, "assets", ...relativePath.split("/"));
    }
    buildPlaceholderImageMeta(metaPath) {
        const existing = this.readJsonFile(metaPath);
        const existingUuid = existing && typeof existing.uuid === "string" && existing.uuid.trim()
            ? existing.uuid.trim()
            : "";
        const uuid = existingUuid || crypto.randomUUID();
        return {
            ver: "1.0.27",
            importer: "image",
            imported: false,
            uuid,
            files: [".json", ".png"],
            subMetas: {},
            userData: {
                ...(existing?.userData ?? {}),
                type: "sprite-frame",
                fixAlphaTransparencyArtifacts: typeof existing?.userData?.fixAlphaTransparencyArtifacts === "boolean"
                    ? existing.userData.fixAlphaTransparencyArtifacts
                    : false,
                hasAlpha: typeof existing?.userData?.hasAlpha === "boolean"
                    ? existing.userData.hasAlpha
                    : true,
                redirect: `${uuid}@6c48a`,
            },
        };
    }
    readJsonFile(filePath) {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        try {
            const content = fs.readFileSync(filePath, "utf8");
            const value = JSON.parse(content);
            return value && typeof value === "object" ? value : null;
        }
        catch {
            return null;
        }
    }
    async ensureSpriteFrameImageImport(targetUrl, assetUuid) {
        let meta = null;
        try {
            meta = await Editor.Message.request("asset-db", "query-asset-meta", assetUuid);
        }
        catch (error) {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Meta info was not available for "${targetUrl}"`, {
                reason: "The placeholder image asset was created, but the editor could not return its import meta information.",
                context: {
                    targetUrl,
                    error: error instanceof Error ? error.message : String(error),
                },
                suggestion: "Retry after the editor asset database is idle, or inspect the asset import status in the editor.",
            });
        }
        const currentType = typeof meta?.userData?.type === "string" ? meta.userData.type : "";
        if (currentType === "sprite-frame") {
            return;
        }
        if (!meta || typeof meta !== "object") {
            throw new shared_1.AppError("INVALID_ARGUMENT", `Meta info for "${targetUrl}" is invalid`, {
                reason: "The editor returned empty or invalid meta info for the placeholder image asset.",
                context: {
                    targetUrl,
                    assetUuid,
                },
                suggestion: "Retry after the asset database refresh completes.",
            });
        }
        meta.userData = {
            ...(meta.userData ?? {}),
            type: "sprite-frame",
        };
        await Editor.Message.request("asset-db", "save-asset-meta", targetUrl, JSON.stringify(meta, null, 2));
        await Editor.Message.request("asset-db", "reimport-asset", targetUrl);
        await Editor.Message.request("asset-db", "refresh-asset", targetUrl);
    }
    async tryResolveImportedSpriteFrame(targetUrl, asset) {
        if (!this.isImageAssetUrl(targetUrl)) {
            return undefined;
        }
        await this.ensureSpriteFrameImageImport(targetUrl, asset.uuid);
        return this.resolveSpriteFrameSubAsset(targetUrl);
    }
    isImageAssetUrl(url) {
        return /\.(png|jpg|jpeg|webp)$/i.test(url);
    }
    isSpriteFrameAsset(asset) {
        const importer = asset.importer?.toLowerCase();
        const type = asset.type?.toLowerCase();
        return (importer === "sprite-frame" ||
            type === "cc.spriteframe" ||
            asset.url.endsWith("/spriteFrame"));
    }
    resolveSpriteFrameSubAssetUrl(fileUrl) {
        return fileUrl.endsWith("/spriteFrame") ? fileUrl : `${fileUrl}/spriteFrame`;
    }
    async resolveSpriteFrameSubAsset(fileUrl) {
        const primaryUrl = this.resolveSpriteFrameSubAssetUrl(fileUrl);
        const alternatives = [
            primaryUrl,
            primaryUrl.replace(/\.png\/spriteFrame$/i, "/spriteFrame"),
            fileUrl.replace(/\.png$/i, "/spriteFrame"),
        ];
        for (const candidate of alternatives) {
            try {
                return await this.resolveAsset({ url: candidate });
            }
            catch {
                // Try the next known sprite-frame sub-asset url shape.
            }
        }
        throw new shared_1.AppError("INVALID_ARGUMENT", `SpriteFrame sub-asset was not found for "${fileUrl}"`, {
            reason: "The placeholder texture file was created, but the SpriteFrame sub-asset could not be resolved.",
            context: {
                fileUrl,
                triedUrls: alternatives,
            },
            suggestion: "Refresh the asset database and verify how the editor exposes SpriteFrame sub-assets for PNG textures.",
        });
    }
    buildSolidPng(width, height, color) {
        const rgba = this.parseRgba(color);
        const stride = width * 4 + 1;
        const raw = Buffer.alloc(stride * height);
        for (let y = 0; y < height; y += 1) {
            const rowOffset = y * stride;
            raw[rowOffset] = 0;
            for (let x = 0; x < width; x += 1) {
                const pixelOffset = rowOffset + 1 + x * 4;
                raw[pixelOffset] = rgba.r;
                raw[pixelOffset + 1] = rgba.g;
                raw[pixelOffset + 2] = rgba.b;
                raw[pixelOffset + 3] = rgba.a;
            }
        }
        const zlib = require("node:zlib");
        const compressed = zlib.deflateSync(raw);
        const signature = Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);
        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(width, 0);
        ihdr.writeUInt32BE(height, 4);
        ihdr[8] = 8;
        ihdr[9] = 6;
        ihdr[10] = 0;
        ihdr[11] = 0;
        ihdr[12] = 0;
        return Buffer.concat([
            signature,
            this.buildPngChunk("IHDR", ihdr),
            this.buildPngChunk("IDAT", compressed),
            this.buildPngChunk("IEND", Buffer.alloc(0)),
        ]);
    }
    buildPngChunk(type, data) {
        const crc32 = this.getCrc32();
        const typeBuffer = Buffer.from(type, "ascii");
        const length = Buffer.alloc(4);
        length.writeUInt32BE(data.length, 0);
        const crcInput = Buffer.concat([typeBuffer, data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(crcInput), 0);
        return Buffer.concat([length, typeBuffer, data, crc]);
    }
    parseRgba(color) {
        const hex = color.slice(1);
        const value = hex.length === 6 ? `${hex}ff` : hex;
        return {
            r: Number.parseInt(value.slice(0, 2), 16),
            g: Number.parseInt(value.slice(2, 4), 16),
            b: Number.parseInt(value.slice(4, 6), 16),
            a: Number.parseInt(value.slice(6, 8), 16),
        };
    }
    getCrc32() {
        const table = (() => {
            const entries = new Uint32Array(256);
            for (let index = 0; index < 256; index += 1) {
                let value = index;
                for (let bit = 0; bit < 8; bit += 1) {
                    value =
                        (value & 1) !== 0
                            ? 0xedb88320 ^ (value >>> 1)
                            : value >>> 1;
                }
                entries[index] = value >>> 0;
            }
            return entries;
        })();
        return (input) => {
            let crc = 0xffffffff;
            for (const byte of input) {
                crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
            }
            return (crc ^ 0xffffffff) >>> 0;
        };
    }
    normalizeAssetError(error) {
        if (error instanceof shared_1.AppError) {
            return error;
        }
        return error;
    }
}
exports.CocosAssetFacade = CocosAssetFacade;
//# sourceMappingURL=asset-facade.js.map