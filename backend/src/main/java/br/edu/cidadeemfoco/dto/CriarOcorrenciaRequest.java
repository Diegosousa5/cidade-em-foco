package br.edu.cidadeemfoco.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CriarOcorrenciaRequest(
    @NotBlank
    @Size(max = 120)
    String titulo,

    @NotBlank
    String descricao,

    @NotBlank
    @Size(max = 40)
    String categoria,

    @NotNull
    Boolean categoriaPersonalizada,

    @NotBlank
    @Size(max = 255)
    String endereco,

    @NotNull
    @DecimalMin("-90.0")
    @DecimalMax("90.0")
    Double latitude,

    @NotNull
    @DecimalMin("-180.0")
    @DecimalMax("180.0")
    Double longitude
) {
    @AssertTrue(message = "Selecione uma categoria permitida ou informe uma categoria personalizada.")
    public boolean isCategoriaValida() {
        if (Boolean.TRUE.equals(categoriaPersonalizada)) {
            return categoria != null && !categoria.isBlank() && categoria.length() <= 40;
        }

        return "buracos".equals(categoria)
            || "iluminação pública".equals(categoria)
            || "lixo".equals(categoria)
            || "esgoto".equals(categoria)
            || "calçadas".equals(categoria)
            || "espaços públicos".equals(categoria);
    }
}
