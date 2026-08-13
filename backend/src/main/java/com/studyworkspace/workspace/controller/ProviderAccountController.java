package com.studyworkspace.workspace.controller;

import java.util.List;

import com.studyworkspace.auth.security.StudyIngPrincipal;
import com.studyworkspace.auth.service.OAuthAccountService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me/provider-accounts")
public class ProviderAccountController {
	private final OAuthAccountService accounts;

	public ProviderAccountController(OAuthAccountService accounts) {
		this.accounts = accounts;
	}

	@GetMapping
	public List<OAuthAccountService.ProviderAccountView> list(@AuthenticationPrincipal StudyIngPrincipal principal) {
		return accounts.listProviderAccounts(principal.userId());
	}
}
