package in.circloset.clothing;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ClothingRepository extends JpaRepository<ClothingItem, UUID> {
    List<ClothingItem> findByStatus(ClothingItem.Status status);
}
