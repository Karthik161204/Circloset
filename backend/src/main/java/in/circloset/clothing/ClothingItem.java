package in.circloset.clothing;

import in.circloset.user.UserAccount;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "clothing_items")
public class ClothingItem {
    public enum ListingType { RENT, SALE, RENT_AND_SELL }
    public enum Status { AVAILABLE, SOLD, UNAVAILABLE }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private UserAccount owner;

    private String name;
    private String category;
    private String size;
    private String brand;
    private BigDecimal rentalPrice;
    private BigDecimal salePrice;

    @Enumerated(EnumType.STRING)
    private ListingType listingType;

    @Enumerated(EnumType.STRING)
    private Status status = Status.AVAILABLE;

    protected ClothingItem() {
    }

    public UUID getId() { return id; }
    public UserAccount getOwner() { return owner; }
    public String getName() { return name; }
    public String getCategory() { return category; }
    public String getSize() { return size; }
    public String getBrand() { return brand; }
    public BigDecimal getRentalPrice() { return rentalPrice; }
    public BigDecimal getSalePrice() { return salePrice; }
    public ListingType getListingType() { return listingType; }
    public Status getStatus() { return status; }
}
