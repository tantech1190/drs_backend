# Drs Club API Documentation

## Base URL
```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

## Authentication
Most endpoints require authentication using JWT Bearer token.

```
Authorization: Bearer <your_jwt_token>
```

The token is returned upon successful sign-up or sign-in and should be included in the Authorization header for protected routes.

---

## API Endpoints

### 🔐 Authentication

#### 1. Sign Up
Create a new user account (Doctor or Vendor)

**Endpoint:** `POST /auth/signup`  
**Auth Required:** No

**Request Body:**
```json
{
  "username": "drjohnsmith",
  "email": "drjohn@example.com",
  "password": "password123",
  "userType": "doctor" // or "vendor"
}
```

**Success Response:** `201 Created`
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "drjohnsmith",
    "email": "drjohn@example.com",
    "userType": "doctor",
    "isOnboarded": false
  }
}
```

---

#### 2. Sign In
Authenticate existing user

**Endpoint:** `POST /auth/signin`  
**Auth Required:** No

**Request Body:**
```json
{
  "username": "drjohnsmith",
  "password": "password123",
  "userType": "doctor"
}
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "message": "Signed in successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "drjohnsmith",
    "email": "drjohn@example.com",
    "userType": "doctor",
    "isOnboarded": true,
    "firstName": "John",
    "lastName": "Smith"
  }
}
```

---

#### 3. Get Current User
Retrieve current authenticated user information

**Endpoint:** `GET /auth/me`  
**Auth Required:** Yes

**Success Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "drjohnsmith",
    "email": "drjohn@example.com",
    "userType": "doctor",
    "firstName": "John",
    "lastName": "Smith",
    "specialty": "Cardiology",
    "isOnboarded": true
  }
}
```

---

#### 4. Doctor Onboarding
Complete doctor profile setup with document uploads

**Endpoint:** `POST /auth/onboarding/doctor`  
**Auth Required:** Yes (Doctor only)  
**Content-Type:** `multipart/form-data`

**Form Data:**
```
firstName: John
lastName: Smith
specialty: Cardiology
subSpecialty: Interventional Cardiology
location: 123 Medical Center Dr
city: New York
state: NY
zip: 10001
phone: +1234567890
bio: Experienced cardiologist with 15 years in practice
profilePicture: [FILE]
medicalLicense: [FILE] (Required)
degreeCertificate: [FILE] (Required)
boardCertification: [FILE] (Optional)
```

**Success Response:** `200 OK`

---

#### 5. Vendor Onboarding
Complete vendor profile setup

**Endpoint:** `POST /auth/onboarding/vendor`  
**Auth Required:** Yes (Vendor only)  
**Content-Type:** `multipart/form-data`

**Form Data:**
```
companyName: MedTech Supply Co
contactPerson: Jane Doe
phone: +1234567890
website: https://medtechsupply.com
category: Medical Equipment
address: 456 Business Blvd
city: Los Angeles
state: CA
zip: 90001
description: Leading supplier of medical equipment
servicesOffered: Medical equipment, surgical supplies
companyLogo: [FILE]
businessLicense: [FILE] (Optional)
```

---

### 👥 Users

#### 1. Search Users
Search for doctors or vendors with filters

**Endpoint:** `GET /users/search`  
**Auth Required:** Yes

**Query Parameters:**
- `type` - Filter by user type (doctor/vendor)
- `specialty` - Filter by specialty (for doctors)
- `category` - Filter by category (for vendors)
- `location` - Filter by city or state
- `search` - Search by name or company name

**Example:**
```
GET /users/search?type=doctor&specialty=Cardiology&location=New York
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "users": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "username": "drjohnsmith",
      "userType": "doctor",
      "firstName": "John",
      "lastName": "Smith",
      "city": "New York",
      "state": "NY",
      "specialty": "Cardiology",
      "profilePicture": "/uploads/images/img-123.jpg",
      "isConnected": false
    }
  ]
}
```

---

#### 2. Get Featured Vendors
Retrieve vendors with active featured promotions

**Endpoint:** `GET /users/featured-vendors`  
**Auth Required:** No

**Success Response:** `200 OK`
```json
{
  "success": true,
  "vendors": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "companyName": "MedTech Supply Co",
      "category": "Medical Equipment",
      "city": "Los Angeles",
      "state": "CA",
      "companyLogo": "/uploads/images/logo-456.png",
      "description": "Leading supplier of medical equipment"
    }
  ]
}
```

---

#### 3. Get User By ID
Retrieve user profile by ID (limited info if not connected)

**Endpoint:** `GET /users/:id`  
**Auth Required:** Yes

**Success Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "drjohnsmith",
    "userType": "doctor",
    "firstName": "John",
    "lastName": "Smith",
    "city": "New York",
    "state": "NY",
    "isConnected": true,
    "phone": "+1234567890",
    "email": "drjohn@example.com",
    "bio": "Experienced cardiologist..."
  }
}
```

---

#### 4. Update Profile
Update current user's profile

**Endpoint:** `PUT /users/profile`  
**Auth Required:** Yes

**Request Body (Doctor):**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "bio": "Updated bio",
  "phone": "+1234567890",
  "city": "Boston",
  "state": "MA"
}
```

---

### 🔗 Connections

#### 1. Send Connection Request
Send a connection request to another user

**Endpoint:** `POST /connections/request`  
**Auth Required:** Yes

**Request Body:**
```json
{
  "recipientId": "507f1f77bcf86cd799439012",
  "message": "Hi! I'd like to connect with you."
}
```

**Success Response:** `201 Created`

---

#### 2. Get Pending Requests
Get all pending connection requests received

**Endpoint:** `GET /connections/pending`  
**Auth Required:** Yes

**Success Response:** `200 OK`
```json
{
  "success": true,
  "requests": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "requester": {
        "_id": "507f1f77bcf86cd799439014",
        "username": "drjanesmith",
        "firstName": "Jane",
        "lastName": "Smith",
        "userType": "doctor",
        "city": "Boston",
        "state": "MA"
      },
      "message": "Hi! I'd like to connect.",
      "status": "pending",
      "createdAt": "2024-12-04T10:00:00.000Z"
    }
  ]
}
```

---

#### 3. Accept Connection Request
Accept a pending connection request

**Endpoint:** `POST /connections/accept/:connectionId`  
**Auth Required:** Yes

**Success Response:** `200 OK`

---

#### 4. Reject Connection Request
Reject a pending connection request

**Endpoint:** `POST /connections/reject/:connectionId`  
**Auth Required:** Yes

**Success Response:** `200 OK`

---

#### 5. Get My Connections
Get all accepted connections

**Endpoint:** `GET /connections/my-connections`  
**Auth Required:** Yes

**Success Response:** `200 OK`
```json
{
  "success": true,
  "connections": [
    {
      "_id": "507f1f77bcf86cd799439015",
      "username": "drjanesmith",
      "firstName": "Jane",
      "lastName": "Smith",
      "userType": "doctor",
      "specialty": "Neurology",
      "city": "Boston",
      "state": "MA"
    }
  ]
}
```

---

#### 6. Remove Connection
Remove an existing connection

**Endpoint:** `DELETE /connections/:userId`  
**Auth Required:** Yes

**Success Response:** `200 OK`

---

### 💬 Chat

#### 1. Get Conversations
Get all conversations with last message and unread count

**Endpoint:** `GET /chat/conversations`  
**Auth Required:** Yes

**Success Response:** `200 OK`
```json
{
  "success": true,
  "conversations": [
    {
      "partner": {
        "_id": "507f1f77bcf86cd799439016",
        "username": "drjanesmith",
        "firstName": "Jane",
        "lastName": "Smith",
        "userType": "doctor"
      },
      "lastMessage": {
        "_id": "507f1f77bcf86cd799439017",
        "content": "Thanks for connecting!",
        "createdAt": "2024-12-04T10:30:00.000Z"
      },
      "unreadCount": 2
    }
  ]
}
```

---

#### 2. Get Messages with User
Get chat history with a specific connected user

**Endpoint:** `GET /chat/messages/:userId`  
**Auth Required:** Yes

**Success Response:** `200 OK`
```json
{
  "success": true,
  "messages": [
    {
      "_id": "507f1f77bcf86cd799439018",
      "sender": "507f1f77bcf86cd799439011",
      "recipient": "507f1f77bcf86cd799439016",
      "content": "Hello!",
      "read": true,
      "createdAt": "2024-12-04T10:00:00.000Z"
    }
  ]
}
```

---

#### 3. Send Message
Send a message to a connected user

**Endpoint:** `POST /chat/send`  
**Auth Required:** Yes

**Request Body:**
```json
{
  "recipientId": "507f1f77bcf86cd799439016",
  "content": "Hello! How are you?"
}
```

**Success Response:** `201 Created`

---

#### 4. Get Unread Count
Get total unread message count

**Endpoint:** `GET /chat/unread-count`  
**Auth Required:** Yes

**Success Response:** `200 OK`
```json
{
  "success": true,
  "count": 5
}
```

---

### 📄 Documents (Doctors Only)

#### 1. Get All Documents
Get all documents for current doctor

**Endpoint:** `GET /documents`  
**Auth Required:** Yes (Doctor only)

**Success Response:** `200 OK`
```json
{
  "success": true,
  "documents": [
    {
      "_id": "507f1f77bcf86cd799439019",
      "title": "Medical License",
      "type": "medical-license",
      "fileName": "license.pdf",
      "filePath": "/uploads/documents/doc-123.pdf",
      "fileSize": 1024000,
      "isVerified": false,
      "createdAt": "2024-12-04T09:00:00.000Z"
    }
  ]
}
```

---

#### 2. Upload Document
Upload a new document

**Endpoint:** `POST /documents/upload`  
**Auth Required:** Yes (Doctor only)  
**Content-Type:** `multipart/form-data`

**Form Data:**
```
document: [FILE]
title: Medical License
type: medical-license // medical-license, degree, board-certification, other
notes: Valid until 2025
```

**Success Response:** `201 Created`

---

#### 3. Update Document
Update document details

**Endpoint:** `PUT /documents/:id`  
**Auth Required:** Yes (Doctor only)

**Request Body:**
```json
{
  "title": "Updated Medical License",
  "notes": "Renewed for 2024-2026"
}
```

---

#### 4. Delete Document
Delete a document

**Endpoint:** `DELETE /documents/:id`  
**Auth Required:** Yes (Doctor only)

**Success Response:** `200 OK`

---

#### 5. Download Document
Download a document file

**Endpoint:** `GET /documents/download/:id`  
**Auth Required:** Yes (Doctor only)

**Success Response:** File download

---

### 📅 Events

#### 1. Get All Events
Get all events with optional filters

**Endpoint:** `GET /events`  
**Auth Required:** No

**Query Parameters:**
- `type` - Filter by event type (conference/webinar/networking/workshop/other)
- `status` - Filter by status (upcoming/ongoing/completed/cancelled)
- `upcoming` - Get only upcoming events (true/false)

**Example:**
```
GET /events?type=conference&status=upcoming
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "events": [
    {
      "_id": "507f1f77bcf86cd799439020",
      "title": "Annual Medical Conference 2024",
      "description": "Join us for the largest medical conference",
      "date": "2024-12-15T09:00:00.000Z",
      "location": "Convention Center, New York",
      "type": "conference",
      "organizer": {
        "_id": "507f1f77bcf86cd799439011",
        "firstName": "John",
        "lastName": "Smith"
      },
      "attendees": [],
      "status": "upcoming"
    }
  ]
}
```

---

#### 2. Get Event by ID
Get single event with full details

**Endpoint:** `GET /events/:id`  
**Auth Required:** No

**Success Response:** `200 OK`

---

#### 3. Create Event
Create a new event

**Endpoint:** `POST /events`  
**Auth Required:** Yes  
**Content-Type:** `multipart/form-data`

**Form Data:**
```
title: Annual Medical Conference 2024
description: Join us for the largest medical conference
date: 2024-12-15T09:00:00Z
endDate: 2024-12-17T18:00:00Z
location: Convention Center, New York
type: conference
maxAttendees: 500
isVirtual: false
virtualLink: (optional)
tags: ["medical", "conference", "networking"]
image: [FILE] (optional)
```

**Success Response:** `201 Created`

---

#### 4. Update Event
Update event (Organizer only)

**Endpoint:** `PUT /events/:id`  
**Auth Required:** Yes (Organizer only)  
**Content-Type:** `multipart/form-data`

---

#### 5. Delete Event
Delete event (Organizer only)

**Endpoint:** `DELETE /events/:id`  
**Auth Required:** Yes (Organizer only)

**Success Response:** `200 OK`

---

#### 6. Register for Event
Register for an event

**Endpoint:** `POST /events/:id/register`  
**Auth Required:** Yes

**Success Response:** `200 OK`

---

#### 7. Unregister from Event
Unregister from an event

**Endpoint:** `POST /events/:id/unregister`  
**Auth Required:** Yes

**Success Response:** `200 OK`

---

#### 8. Get My Registered Events
Get all events current user is registered for

**Endpoint:** `GET /events/my/registered`  
**Auth Required:** Yes

**Success Response:** `200 OK`

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "No authentication token, access denied"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Doctors only."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Server error message"
}
```

---

## File Upload Guidelines

### Accepted Formats
- **Documents:** PDF, JPG, JPEG, PNG
- **Images:** JPG, JPEG, PNG, GIF

### Size Limits
- **Documents:** 10MB max
- **Images:** 5MB max

### Upload Endpoints
All file uploads use `multipart/form-data` encoding.

---

## WebSocket Events (Real-time Chat)

### Client → Server

**user:join**
```javascript
socket.emit('user:join', userId);
```

**message:send**
```javascript
socket.emit('message:send', {
  recipientId: 'userId',
  content: 'Hello!',
  senderId: 'myUserId'
});
```

**typing:start**
```javascript
socket.emit('typing:start', {
  userId: 'myUserId',
  recipientId: 'userId'
});
```

**typing:stop**
```javascript
socket.emit('typing:stop', {
  userId: 'myUserId',
  recipientId: 'userId'
});
```

### Server → Client

**users:online**
```javascript
socket.on('users:online', (userIds) => {
  // Array of online user IDs
});
```

**message:receive**
```javascript
socket.on('message:receive', (data) => {
  // New message received
});
```

**typing:show**
```javascript
socket.on('typing:show', ({ userId }) => {
  // User started typing
});
```

**typing:hide**
```javascript
socket.on('typing:hide', ({ userId }) => {
  // User stopped typing
});
```

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding rate limiting in production:
- Authentication endpoints: 5 requests per minute
- Search endpoints: 30 requests per minute
- File uploads: 10 requests per minute

---

## Best Practices

1. **Always include authentication token** for protected routes
2. **Handle file uploads properly** using FormData
3. **Validate user input** on the client side before sending
4. **Implement proper error handling** for all API calls
5. **Use WebSocket for real-time features** instead of polling
6. **Cache user data** to reduce API calls
7. **Implement retry logic** for failed requests

---

## Testing the API

### Using Postman
1. Import `Drs-Club-API-Collection.postman_collection.json`
2. Import `Drs-Club-Environment.postman_environment.json`
3. Set the `base_url` variable to your API URL
4. Start with authentication endpoints to get a token
5. The token will be automatically saved to the environment

### Using cURL

**Sign Up:**
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "drjohnsmith",
    "email": "drjohn@example.com",
    "password": "password123",
    "userType": "doctor"
  }'
```

**Get Current User:**
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Support

For questions or issues, please contact the development team or refer to the main README.md file.
