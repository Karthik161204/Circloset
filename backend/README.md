# CIRCLOSET Spring Boot Backend

This service is the Java backend foundation for CIRCLOSET.

## Stack

- Spring Boot, Spring Web, Spring Security
- Spring Data JPA, Hibernate, PostgreSQL
- Supabase PostgreSQL and Storage
- Redis
- STOMP over Spring WebSocket
- REST endpoints under `/api`

## Run locally

1. Install Java 21+ and Maven 3.9+.
2. Copy `.env.example` values into your shell or IDE run configuration.
3. Set `SUPABASE_DB_PASSWORD` and `SUPABASE_SERVICE_ROLE_KEY` locally. Do not commit them.
4. Start Redis and run:

```bash
mvn spring-boot:run
```

Health check: `GET http://localhost:8080/api/health`

WebSocket endpoint: `ws://localhost:8080/ws`

The current REST sample protects application endpoints with HTTP Basic authentication while the full Supabase Auth/JWT flow is migrated. The existing Node backend remains available during this migration.
