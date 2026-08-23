package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.AccountDeletionService;
import com.example.popspotbackend.service.auth.FreshAuthenticationService;
import com.example.popspotbackend.service.media.ImageUploadGuard;
import com.example.popspotbackend.service.media.UploadQuotaService;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

class UserProfileAccountDeletionSecurityTest {

    @Test
    @DisplayName("최근 재인증 검사가 실패하면 회원 데이터를 삭제하지 않는다")
    void doesNotDeleteWhenFreshAuthenticationIsMissing() {
        AccountDeletionService deletion = mock(AccountDeletionService.class);
        FreshAuthenticationService freshAuthentication = mock(FreshAuthenticationService.class);
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken("user-1", null, List.of());
        ResponseStatusException failure =
                new ResponseStatusException(
                        org.springframework.http.HttpStatus.PRECONDITION_REQUIRED);
        doThrow(failure).when(freshAuthentication).requireFresh(authentication);
        UserProfileController controller = controller(deletion, freshAuthentication);

        assertThatThrownBy(() -> controller.deleteMe(authentication)).isSameAs(failure);

        verify(deletion, never()).deleteAccount("user-1");
    }

    private static UserProfileController controller(
            AccountDeletionService deletion, FreshAuthenticationService freshAuthentication) {
        return new UserProfileController(
                mock(UserRepository.class),
                deletion,
                freshAuthentication,
                "api\\.popspot\\.co\\.kr",
                false,
                "build/test-uploads",
                mock(ImageUploadGuard.class),
                mock(UploadQuotaService.class));
    }
}
