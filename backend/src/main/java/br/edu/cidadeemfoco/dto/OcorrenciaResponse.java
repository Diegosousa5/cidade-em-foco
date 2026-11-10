package br.edu.cidadeemfoco.dto;

import java.time.Instant;

public record OcorrenciaResponse(
    Long id,
    String titulo,
    String descricao,
    String categoria,
    String endereco,
    String status,
    Instant dataCriacao,
    double latitude,
    double longitude
) {
}
