package com.studyworkspace.auth.controller;

import java.util.Map;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class CsrfController {

	@GetMapping("/csrf")
	public Map<String, String> csrf(CsrfToken token) {
		return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
	}
}
