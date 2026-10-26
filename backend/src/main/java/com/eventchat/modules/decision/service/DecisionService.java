package com.eventchat.modules.decision.service;

import com.eventchat.modules.decision.dto.request.ConfirmDecisionRequest;
import com.eventchat.modules.decision.dto.request.CreateDecisionRequest;
import com.eventchat.modules.decision.dto.request.UpdateDecisionStatusRequest;
import com.eventchat.modules.decision.dto.response.DecisionResponse;

import java.util.List;

public interface DecisionService {

    DecisionResponse createDecision(String slug, String rawSessionToken, CreateDecisionRequest request);

    DecisionResponse confirmDecision(String slug, Long decisionId, String rawSessionToken, ConfirmDecisionRequest request);

    DecisionResponse updateDecisionStatus(String slug, Long decisionId, String rawHostToken, UpdateDecisionStatusRequest request);

    List<DecisionResponse> getDecisionsByRoom(String slug);
}
