<?php

declare(strict_types=1);

/*
 * Image endpoint
 * 
 * Set image:
 *   /image?token=foobar&src=https://example.org/image.jpg
 * 
 * Get image:
 *   /image?token=foobar
 * 
 * Req:
 *   - PHP 8+
 *   - curl extension
 *   - FileInfo extension
 */
const DATA_DIR = __DIR__ . '/data';
const CONFIG_FILE = DATA_DIR . '/config.json';
const CACHE_DIR = DATA_DIR . '/cache';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const CURL_TIMEOUT = 15;

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($_GET['src'] === null) {
    serveImage();
    exit;
}

setImage();

// ============================================================================
// Set image
// ============================================================================
function setImage(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        respond(405, 'set: Method Not Allowed');
    }

    $token = $_GET['token'] ?? null;
    $source = $_GET['src'] ?? null;

    if (!is_string($token) || !is_string($source)) {
        respond(400, 'Missing parameter');
    }

    if (!isValidToken($token)) {
        respond(400, 'set: Invalid token');
    }

    if (!isAllowedUrl($source)) {
        respond(400, 'Invalid URL');
    }

    $image = downloadImage($source);

    if ($image === null) {
        respond(400, 'Could not retrieve image');
    }

    ensureDirectories();

    $extension = extensionForMime($image['mime']);

    if ($extension === null) {
        respond(400, 'Unsupported image format');
    }

    $file = CACHE_DIR . '/' . hash('sha256', $token) . '.' . $extension;

    // Remove old files from token
    foreach (glob(CACHE_DIR . '/' . hash('sha256', $token) . '.*')?: [] as $oldFile) {
        @unlink($oldFile);
    }

    if (file_put_contents($file, $image['data'], LOCK_EX) === false) {
        respond(500, 'Could not save image');
    }

    $config = loadConfig();

    $config[$token] = [
        'source' => $source,
        'file' => basename($file),
        'mime' => $image['mime'],
        'updated' => time()
    ];

    saveConfig($config);

    header('Content-Type: application/json; charset=utf-8');

    echo json_encode([
        'success' => true,
        'token' => $token,
        'mime' => $image['mime'],
        'size' => strlen($image['data'])
    ], JSON_PRETTY_PRINT);
}

// ============================================================================
// Serve image
// ============================================================================
function serveImage(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        respond(405, 'serve: Method Not Allowed');
    }

    $token = $_GET['token'] ?? null;

    if (!is_string($token) || !isValidToken($token)) {
        respond(401, 'serve: Invalid token');
    }

    $config = loadConfig();

    if (!isset($config[$token])) {
        respond(404, 'Image not found');
    }

    $image = $config[$token];

    $file = CACHE_DIR . '/' . basename($image['file']);

    if (!is_file($file)) {
        respond(404, 'Image file not found');
    }

    $mime = $image['mime'];

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($file));

    // Browser caching
    header('Cache-Control: no-cache');

    // Use modification time as ETag
    $etag = '"' . md5_file($file) . '"';
    header('ETag: ' . $etag);

    if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
        http_response_code(304);
        exit;
    }

    readfile($file);
}

// ============================================================================
// Download image
// ============================================================================
function downloadImage(string $url): ?array
{
    $ch = curl_init($url);

    if ($ch === false) {
        return null;
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_CONNECTTIMEOUT => CURL_TIMEOUT,
        CURLOPT_USERAGENT => 'Mozilla/5.0',
        CURLOPT_HTTPHEADER => [
            'Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        ],
        CURLOPT_NOPROGRESS => false,
        CURLOPT_PROGRESSFUNCTION => function (
            $resource,
            float $downloadSize,
            float $downloaded,
            float $uploadSize,
            float $uploaded
        ): int {
            if ($downloaded > MAX_FILE_SIZE) {
                return 1;
            }
            
            return 0;
        }
    ]);

    $data = curl_exec($ch);

    if ($data === false) {
        return null;
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

    if ($httpCode < 200 || $httpCode >= 300) {
        return null;
    }

    if (!is_string($data) || strlen($data) > MAX_FILE_SIZE) {
        return null;
    }

    // Determine actual mime type
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->buffer($data);

    if (!is_string($mime)) {
        return null;
    }

    if (!isAllowedMime($mime)) {
        return null;
    }

    return [
        'data' => $data,
        'mime' => $mime
    ];
}

// ============================================================================
// Validation
// ============================================================================
function isValidToken(string $token): bool
{
    // 8 chars, alphanumeric + - _
    return preg_match('/^[A-Za-z0-9_-]{8}$/', $token) === 1;
}

function isAllowedUrl(string $url): bool
{
    $parts = parse_url($url);

    if ($parts === false) {
        return false;
    }

    if (!isset($parts['scheme'], $parts['host'])) {
        return false;
    }

    if (!in_array(strtolower($parts['scheme']), ['http', 'https'], true)) {
        return false;
    }

    $host = strtolower($parts['host']);

    // Reject localhost
    if ($host === 'localhost' || $host === 'localhost.localdomain') {
        return false;
    }

    // Resolve hostname
    $ips = gethostbynamel($host);

    if ($ips === false) {
        return false;
    }

    foreach ($ips as $ip) {
        if (!filter_var(
            $ip, 
            FILTER_VALIDATE_IP, 
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return false;
            }
    }

    return true;
}

function isAllowedMime(string $mime): bool
{
    return in_array($mime, [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/avif',
        'image/bmp',
        'image/x-icon'
    ], true);
}

function extensionForMime(string $mime): ?string
{
    return match ($mime) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'image/avif' => 'avif',
        'image/bmp' => 'bmp',
        'image/x-icon' => 'ico',
        default => null
    };
}

// ============================================================================
// Storage
// ============================================================================
function ensureDirectories(): void
{
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0750, true);
    }

    if (!is_dir(CACHE_DIR)) {
        mkdir(CACHE_DIR, 0750, true);
    }

    if (!file_exists(CONFIG_FILE)) {
        file_put_contents(CONFIG_FILE, '{}', LOCK_EX);
    }
}

function loadConfig(): array
{
    ensureDirectories();

    $json = file_get_contents(CONFIG_FILE);

    if ($json === false) {
        return [];
    }

    $data = json_decode($json, true);

    return is_array($data) ? $data: [];
}

function saveConfig(array $config): void
{
    $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

    if ($json === false) {
        respond(500, 'Could not encode config');
    }

    $temp = CONFIG_FILE . '.tmp';

    if (file_put_contents($temp, $json, LOCK_EX) === false) {
        respond(500, 'Could not save config');
    }

    rename($temp, CONFIG_FILE);
}

// ============================================================================
// Response
// ============================================================================
function respond(int $status, string $message): never
{
    http_response_code($status);

    header('Content-Type: application/json; charset=utf-8');

    echo json_encode([
        'success' => false,
        'error' => $message
    ], JSON_PRETTY_PRINT);

    exit;
}
