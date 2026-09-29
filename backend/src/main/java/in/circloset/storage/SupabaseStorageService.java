package in.circloset.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.Objects;

@Service
public class SupabaseStorageService {
    private final RestClient client;
    private final String serviceKey;
    private final String bucket;
    private final String supabaseUrl;

    public SupabaseStorageService(
        @Value("${supabase.url}") String supabaseUrl,
        @Value("${supabase.service-key}") String serviceKey,
        @Value("${supabase.storage-bucket}") String bucket
    ) {
        this.supabaseUrl = supabaseUrl;
        this.serviceKey = serviceKey;
        this.bucket = bucket;
        this.client = RestClient.builder().baseUrl(supabaseUrl).build();
    }

    public String upload(String objectPath, byte[] content, String contentType) {
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new IllegalStateException("SUPABASE_SERVICE_ROLE_KEY is required for uploads");
        }
        client.post()
            .uri("/storage/v1/object/{bucket}/{path}", bucket, objectPath)
            .header("Authorization", "Bearer " + serviceKey)
            .header("apikey", serviceKey)
            .contentType(MediaType.parseMediaType(Objects.requireNonNullElse(contentType, MediaType.APPLICATION_OCTET_STREAM_VALUE)))
            .body(content)
            .retrieve()
            .toBodilessEntity();
        return supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + objectPath;
    }
}
