package com.studyworkspace;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class StudyWorkspaceApplication {

	public static void main(String[] args) {
		SpringApplication.run(StudyWorkspaceApplication.class, args);
	}
}
