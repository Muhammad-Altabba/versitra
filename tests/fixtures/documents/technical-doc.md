# API Documentation

## Overview

The Git Translation Platform provides a comprehensive REST API for managing translation projects, documents, and translations. All endpoints require authentication via OAuth tokens.

## Authentication

All API requests must include an `Authorization` header with a valid OAuth token:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Endpoints

### Projects

#### List Projects
- **Endpoint**: `GET /api/projects`
- **Description**: Retrieve all projects for the authenticated user
- **Response**: Array of project objects
- **Example**:
  ```json
  [
    {
      "id": "proj_123",
      "title": "Documentation Translation",
      "sourceLanguage": "en",
      "targetLanguage": "es",
      "status": "active"
    }
  ]
  ```

#### Create Project
- **Endpoint**: `POST /api/projects`
- **Description**: Create a new translation project
- **Parameters**:
  - `title` (string): Project name
  - `sourceLanguage` (string): Source language code
  - `targetLanguage` (string): Target language code
- **Response**: Created project object

### Documents

#### Upload Document
- **Endpoint**: `POST /api/projects/:projectId/documents`
- **Description**: Upload a document for translation
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `file` (file): Document file (PDF, TXT, MD)
- **Response**: Document object with parsed sections

#### Get Document
- **Endpoint**: `GET /api/projects/:projectId/documents/:docId`
- **Description**: Retrieve document details and sections
- **Response**: Document object with full section list

### Translations

#### Get Translation
- **Endpoint**: `GET /api/sections/:sectionId/translation`
- **Description**: Retrieve current translation for a section
- **Response**: Translation object with status and content

#### Save Draft
- **Endpoint**: `POST /api/sections/:sectionId/draft`
- **Description**: Save a draft translation
- **Parameters**:
  - `content` (string): Draft translation text
- **Response**: Draft object with timestamp

#### Commit Translation
- **Endpoint**: `POST /api/sections/:sectionId/commit`
- **Description**: Commit a translation to Git
- **Parameters**:
  - `message` (string): Commit message
- **Response**: Commit object with hash and timestamp

## Error Handling

The API returns standard HTTP status codes:

- `200 OK`: Request successful
- `201 Created`: Resource created
- `400 Bad Request`: Invalid parameters
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses include a JSON body with details:

```json
{
  "error": "Invalid project ID",
  "code": "INVALID_PROJECT_ID",
  "details": "Project proj_invalid does not exist"
}
```

## Rate Limiting

API requests are rate-limited to 1000 requests per hour per user. Rate limit information is included in response headers:

- `X-RateLimit-Limit`: Maximum requests per hour
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Examples

### Create a Project and Upload Document

```bash
# Create project
curl -X POST https://api.example.com/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "User Guide Translation",
    "sourceLanguage": "en",
    "targetLanguage": "fr"
  }'

# Upload document
curl -X POST https://api.example.com/api/projects/proj_123/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@guide.pdf"
```

### Translate and Commit

```bash
# Save draft
curl -X POST https://api.example.com/api/sections/sec_456/draft \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Translated section content..."
  }'

# Commit translation
curl -X POST https://api.example.com/api/sections/sec_456/commit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Translate section 1"
  }'
```
