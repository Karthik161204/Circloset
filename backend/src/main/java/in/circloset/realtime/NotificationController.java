package in.circloset.realtime;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class NotificationController {
    public record NotificationMessage(String type, String message) {}

    @MessageMapping("/notifications")
    @SendTo("/topic/notifications")
    public NotificationMessage broadcast(NotificationMessage message) {
        return message;
    }
}
