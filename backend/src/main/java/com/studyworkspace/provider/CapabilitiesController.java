package com.studyworkspace.provider;

import java.util.List;
import java.util.Map;

import com.studyworkspace.workspace.domain.RepositoryProvider;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/capabilities")
public class CapabilitiesController {
	public record CapabilitiesResponse(
		List<RepositoryProvider> authProviders,
		List<RepositoryProvider> accountLinkProviders,
		List<RepositoryProvider> repositoryProviders,
		Map<String, Boolean> features
	) { }

	private final ProviderCapabilities capabilities;

	public CapabilitiesController(ProviderCapabilities capabilities) { this.capabilities = capabilities; }

	@GetMapping
	public CapabilitiesResponse get() {
		return new CapabilitiesResponse(
			capabilities.authProviders(), capabilities.accountLinkProviders(), capabilities.repositoryProviders(), capabilities.features()
		);
	}
}
