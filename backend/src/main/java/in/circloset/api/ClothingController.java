package in.circloset.api;

import in.circloset.clothing.ClothingItem;
import in.circloset.clothing.ClothingRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/clothing")
public class ClothingController {
    private final ClothingRepository clothingRepository;

    public ClothingController(ClothingRepository clothingRepository) {
        this.clothingRepository = clothingRepository;
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(required = false) String status) {
        var items = status == null
            ? clothingRepository.findAll()
            : clothingRepository.findByStatus(ClothingItem.Status.valueOf(status.toUpperCase()));
        return items.stream().map(item -> Map.<String, Object>of(
            "id", item.getId(),
            "name", item.getName(),
            "category", item.getCategory(),
            "size", item.getSize(),
            "brand", item.getBrand(),
            "rentalPrice", item.getRentalPrice(),
            "salePrice", item.getSalePrice(),
            "listingType", item.getListingType(),
            "status", item.getStatus()
        )).toList();
    }
}
