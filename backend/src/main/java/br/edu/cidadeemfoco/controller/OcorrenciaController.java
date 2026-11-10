package br.edu.cidadeemfoco.controller;

import br.edu.cidadeemfoco.dto.CriarOcorrenciaRequest;
import br.edu.cidadeemfoco.dto.OcorrenciaResponse;
import br.edu.cidadeemfoco.service.OcorrenciaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;

@RestController
@RequestMapping("/api/ocorrencias")
public class OcorrenciaController {

    private final OcorrenciaService ocorrenciaService;

    public OcorrenciaController(OcorrenciaService ocorrenciaService) {
        this.ocorrenciaService = ocorrenciaService;
    }

    @PostMapping
    public ResponseEntity<OcorrenciaResponse> cadastrar(
        @Valid @RequestBody CriarOcorrenciaRequest request
    ) {
        OcorrenciaResponse response = ocorrenciaService.cadastrar(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<OcorrenciaResponse>> listarTodas() {
        return ResponseEntity.ok(ocorrenciaService.listarTodas());
    }

    @GetMapping("/area")
    public ResponseEntity<List<OcorrenciaResponse>> listarPorArea(
        @RequestParam double minLatitude,
        @RequestParam double minLongitude,
        @RequestParam double maxLatitude,
        @RequestParam double maxLongitude
    ) {
        return ResponseEntity.ok(ocorrenciaService.listarPorArea(
            minLatitude,
            minLongitude,
            maxLatitude,
            maxLongitude
        ));
    }

    @GetMapping("/proximas")
    public ResponseEntity<List<OcorrenciaResponse>> listarProximas(
        @RequestParam double latitude,
        @RequestParam double longitude,
        @RequestParam(defaultValue = "2000") double raioMetros
    ) {
        return ResponseEntity.ok(ocorrenciaService.listarProximas(
            latitude,
            longitude,
            raioMetros
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<OcorrenciaResponse> atualizar(
        @PathVariable Long id,
        @Valid @RequestBody CriarOcorrenciaRequest request
    ) {
        return ResponseEntity.ok(ocorrenciaService.atualizar(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        ocorrenciaService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
